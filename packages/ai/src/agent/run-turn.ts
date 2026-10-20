import { HumanMessage } from "@langchain/core/messages";
import { Command, type BaseCheckpointSaver } from "@langchain/langgraph";
import { AppError, tripMessages } from "@pureluxe/shared";

import { aiError, aiProviderFailedError } from "../errors";
import type { AgentStreamChunk, TurnMeter } from "../tools";
import type { ChatHistoryMessage, TripFacts } from "../types";

import { tripThreadId } from "./checkpointer";
import {
  buildTripAgentGraph,
  type TripAgentDeps,
  type TripAgentGraph,
  type TripAgentNode,
} from "./graph";
import type { AgentModelOptions } from "./model";
import { redactSensitive, redactText } from "./redact";
import type { TripAgentStateUpdate } from "./state";
import { toAgentChunks } from "./stream";
import { findAgentTool } from "./tools";
import type { AgentTurnRequest, TripAgentHandlers } from "./types";

/** Graph steps per turn. The tool-round cap ends a turn well before this; it is a safety net. */
const RECURSION_LIMIT = 25;

export type TripAgentTurnInput = {
  tripId: string;
  request: AgentTurnRequest;
  handlers: TripAgentHandlers;
  checkpointer: BaseCheckpointSaver;
  /** YYYY-MM-DD in the agency's time zone. */
  today: string;
  /**
   * Trip facts the caller started loading with the request, so the load overlaps
   * with saving the message and reading agent memory. Loaded here when omitted.
   */
  trip?: Promise<TripFacts>;
  /** Earlier chat, loaded only when this trip has no saved agent memory yet. */
  loadHistory?: () => Promise<ChatHistoryMessage[]>;
  /** The same send key arrived again after a reply that did not finish. */
  retry?: boolean;
  meter?: TurnMeter;
  /** Stops the run (and the model call) when the advisor leaves. */
  signal?: AbortSignal;
  models?: AgentModelOptions;
  /** Replaces Claude with other bound models (tests and evals). */
  createModels?: TripAgentDeps["createModels"];
};

type ApprovalDecision = Extract<AgentTurnRequest, { kind: "resume" }>["decision"];

type GraphInput =
  | TripAgentStateUpdate
  | Command<ApprovalDecision, TripAgentStateUpdate, TripAgentNode>
  | null;

/**
 * What to feed the graph. A normal message or tap needs no read of saved memory
 * here: the graph loads it once when it starts (and seeds a new thread itself).
 */
async function toGraphInput(
  graph: TripAgentGraph,
  config: { configurable: { thread_id: string } },
  input: TripAgentTurnInput,
): Promise<GraphInput> {
  const { request } = input;

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
  if (input.retry && (await graph.getState(config)).next.length > 0) return null;

  if (request.kind === "action") {
    return {
      messages: [],
      action: { ...request.action, args: redactSensitive(request.action.args) },
      toolRounds: 0,
    };
  }

  return {
    messages: [new HumanMessage(redactText(request.text))],
    action: null,
    toolRounds: 0,
  };
}

/**
 * One trip agent turn on LangGraph — yields status, progress and text chunks.
 * Progress is saved after every step in the `trip:<id>` thread.
 */
export async function* streamTripAgentTurn(
  input: TripAgentTurnInput,
): AsyncGenerator<AgentStreamChunk, void, unknown> {
  if (input.request.kind === "action" && !findAgentTool(input.request.action.tool)) {
    throw aiError({
      userMessage: tripMessages.error.agentActionUnavailable,
      code: "ai.action_unavailable",
      status: 400,
    });
  }

  yield { kind: "status", phase: "thinking" };

  try {
    const graph = buildTripAgentGraph({
      handlers: input.handlers,
      checkpointer: input.checkpointer,
      today: input.today,
      trip: input.trip,
      loadHistory: input.loadHistory,
      meter: input.meter,
      models: input.models,
      createModels: input.createModels,
    });
    const config = { configurable: { thread_id: tripThreadId(input.tripId) } };
    const graphInput = await toGraphInput(graph, config, input);
    const stream = await graph.stream(graphInput, {
      ...config,
      streamMode: ["messages", "updates"],
      recursionLimit: RECURSION_LIMIT,
      signal: input.signal,
    });
    const summary = yield* toAgentChunks(stream, input.meter);
    if (!summary.sawText) throw aiProviderFailedError();
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw aiProviderFailedError(cause);
  }
}
