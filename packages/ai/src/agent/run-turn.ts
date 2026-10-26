import { HumanMessage } from "@langchain/core/messages";
import { Command, type BaseCheckpointSaver } from "@langchain/langgraph";
import { AppError, tripMessages } from "@pureluxe/shared";

import { aiError, aiProviderFailedError } from "../errors";
import type { AgentStreamChunk, TurnMeter } from "../tools";
import type { ChatHistoryMessage, TripFacts } from "../types";

import { createMemoryCheckpointer, tripThreadId } from "./checkpointer";
import {
  buildHomeAgentGraph,
  buildTripAgentGraph,
  type AgentGraph,
  type TripAgentDeps,
  type TripAgentNode,
} from "./graph";
import { isProviderOutage, type AgentModelOptions } from "./model";
import { redactSensitive, redactText } from "./redact";
import type { TripAgentStateUpdate } from "./state";
import { toAgentChunks } from "./stream";
import { HOME_AGENT_TOOLS, TRIP_AGENT_TOOLS } from "./tools";
import type { AgentTurnRequest, ApprovalDecision, HomeAgentHandlers, TripAgentHandlers } from "./types";

/** Graph steps per turn. The tool-round cap ends a turn well before this; it is a safety net. */
const RECURSION_LIMIT = 25;
/** Extra full-turn attempts after a provider outage or empty reply (SDK already retries per model call). */
const PROVIDER_TURN_RETRIES = 1;

function isAbortError(cause: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError");
}

function isRetryableProviderFailure(cause: unknown): boolean {
  if (cause instanceof AppError && cause.code === "ai.provider_failed") {
    return cause.cause === undefined || isProviderOutage(cause.cause);
  }
  return isProviderOutage(cause);
}

type TurnOptions = {
  /** YYYY-MM-DD in the agency's time zone. */
  today: string;
  meter?: TurnMeter;
  /** Stops the run (and the model call) when the advisor leaves. */
  signal?: AbortSignal;
  models?: AgentModelOptions;
  /** Replaces Claude with other bound models (tests and evals). */
  createModels?: TripAgentDeps["createModels"];
};

export type TripAgentTurnInput = TurnOptions & {
  tripId: string;
  request: AgentTurnRequest;
  handlers: TripAgentHandlers;
  checkpointer: BaseCheckpointSaver;
  /**
   * Trip facts the caller started loading with the request, so the load overlaps
   * with saving the message and reading agent memory. Loaded here when omitted.
   */
  trip?: Promise<TripFacts>;
  /** Earlier chat, loaded only when this trip has no saved agent memory yet. */
  loadHistory?: () => Promise<ChatHistoryMessage[]>;
  /** The same send key arrived again after a reply that did not finish. */
  retry?: boolean;
};

export type HomeAgentTurnInput = TurnOptions & {
  /** A typed message or a button tap. The home chat has no approvals to resume. */
  request: Exclude<AgentTurnRequest, { kind: "resume" }>;
  handlers: HomeAgentHandlers;
  /** The conversation so far, as the browser shows it (the home chat is not saved). */
  history: ChatHistoryMessage[];
};

type GraphInput =
  | TripAgentStateUpdate
  | Command<ApprovalDecision, TripAgentStateUpdate, TripAgentNode>
  | null;

type GraphConfig = { configurable: { thread_id: string } };

/**
 * What to feed the graph. A normal message or tap needs no read of saved memory
 * here: the graph loads it once when it starts (and seeds a new thread itself).
 */
async function toGraphInput(
  graph: AgentGraph,
  config: GraphConfig,
  request: AgentTurnRequest,
  retry: boolean,
): Promise<GraphInput> {
  if (request.kind === "resume") {
    const snapshot = await graph.getState(config);
    const waiting = snapshot.tasks.some((task) => task.interrupts.length > 0);
    if (!waiting) {
      throw aiError({
        userMessage: tripMessages.error.agentNoApproval,
        code: "ai.no_pending_approval",
        status: 409,
      });
    }
    return new Command<ApprovalDecision, TripAgentStateUpdate, TripAgentNode>({
      resume: request.decision,
    });
  }

  // A run cut off mid-way (crash, timeout) continues from its last saved step.
  if (retry && (await graph.getState(config)).next.length > 0) return null;

  if (request.kind === "action") {
    return {
      messages: [],
      action: { ...request.action, args: redactSensitive(request.action.args) },
      toolRounds: 0,
      quickReply: null,
    };
  }

  return {
    messages: [new HumanMessage(redactText(request.text))],
    action: null,
    toolRounds: 0,
    quickReply: null,
  };
}

/** A tap must name a tool this chat has. */
function assertKnownAction(request: AgentTurnRequest, tools: ReadonlyArray<{ name: string }>) {
  if (request.kind !== "action" || tools.some((tool) => tool.name === request.action.tool)) return;
  throw aiError({
    userMessage: tripMessages.error.agentActionUnavailable,
    code: "ai.action_unavailable",
    status: 400,
  });
}

/**
 * Build the graph and stream one turn. Provider failures become one clear error;
 * rule and access errors pass through. One automatic retry on outage / empty reply.
 */
async function* runTurn(input: {
  buildGraph: () => AgentGraph;
  threadId: string;
  request: AgentTurnRequest;
  retry: boolean;
  meter?: TurnMeter;
  signal?: AbortSignal;
}): AsyncGenerator<AgentStreamChunk, void, unknown> {
  yield { kind: "status", phase: "thinking" };

  let lastCause: unknown;
  for (let attempt = 0; attempt <= PROVIDER_TURN_RETRIES; attempt += 1) {
    if (input.signal?.aborted) {
      const aborted = lastCause ?? new Error("Aborted");
      if (aborted instanceof Error) aborted.name = "AbortError";
      throw aborted;
    }
    const resume = input.retry || attempt > 0;
    let emittedText = false;
    try {
      const graph = input.buildGraph();
      const config = { configurable: { thread_id: input.threadId } };
      const graphInput = await toGraphInput(graph, config, input.request, resume);
      const stream = await graph.stream(graphInput, {
        ...config,
        streamMode: ["messages", "updates", "custom"],
        recursionLimit: RECURSION_LIMIT,
        signal: input.signal,
      });
      const summary = yield* (async function* () {
        const gen = toAgentChunks(stream, input.meter);
        while (true) {
          const step = await gen.next();
          if (step.done) return step.value;
          if (step.value.kind === "delta" && step.value.text) emittedText = true;
          yield step.value;
        }
      })();
      if (summary.sawText || summary.paused) return;
      if (isAbortError(undefined, input.signal)) return;
      lastCause = aiProviderFailedError();
      if (attempt < PROVIDER_TURN_RETRIES) {
        console.warn("[ai] provider turn empty reply; retrying once", {
          threadId: input.threadId,
          attempt: attempt + 1,
        });
        continue;
      }
      throw lastCause;
    } catch (cause) {
      if (isAbortError(cause, input.signal)) throw cause;
      if (cause instanceof AppError && cause.code !== "ai.provider_failed") throw cause;
      lastCause = cause instanceof AppError ? cause : aiProviderFailedError(cause);
      // Never retry after the client already saw text — that would duplicate the stream.
      if (
        !emittedText &&
        attempt < PROVIDER_TURN_RETRIES &&
        isRetryableProviderFailure(lastCause)
      ) {
        console.warn("[ai] provider turn failed; retrying once", {
          threadId: input.threadId,
          attempt: attempt + 1,
          code: lastCause instanceof AppError ? lastCause.code : null,
        });
        continue;
      }
      throw lastCause;
    }
  }
}

/**
 * One trip agent turn on LangGraph — yields status, progress and text chunks.
 * Progress is saved after every step in the `trip:<id>` thread.
 */
export async function* streamTripAgentTurn(
  input: TripAgentTurnInput,
): AsyncGenerator<AgentStreamChunk, void, unknown> {
  assertKnownAction(input.request, TRIP_AGENT_TOOLS);
  yield* runTurn({
    buildGraph: () =>
      buildTripAgentGraph({
        handlers: input.handlers,
        checkpointer: input.checkpointer,
        today: input.today,
        trip: input.trip,
        loadHistory: input.loadHistory,
        meter: input.meter,
        models: input.models,
        createModels: input.createModels,
      }),
    threadId: tripThreadId(input.tripId),
    request: input.request,
    retry: input.retry ?? false,
    meter: input.meter,
    signal: input.signal,
  });
}

/**
 * One home-chat turn (no trip open). Nothing is saved between messages: each turn
 * starts from the conversation the browser sends, like the chat the advisor sees.
 */
export async function* streamHomeAgentTurn(
  input: HomeAgentTurnInput,
): AsyncGenerator<AgentStreamChunk, void, unknown> {
  assertKnownAction(input.request, HOME_AGENT_TOOLS);
  yield* runTurn({
    buildGraph: () =>
      buildHomeAgentGraph({
        handlers: input.handlers,
        checkpointer: createMemoryCheckpointer(),
        today: input.today,
        loadHistory: async () => input.history,
        meter: input.meter,
        models: input.models,
        createModels: input.createModels,
      }),
    threadId: "home",
    request: input.request,
    retry: false,
    meter: input.meter,
    signal: input.signal,
  });
}
