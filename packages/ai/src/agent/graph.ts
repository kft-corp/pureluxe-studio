import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  Command,
  END,
  REMOVE_ALL_MESSAGES,
  START,
  StateGraph,
  interrupt,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import type { AgentApproval, TurnMeter } from "../tools";
import type { ChatHistoryMessage, TripFacts } from "../types";

import { buildTripInstructions } from "./instructions";
import { pruneOldTurns, recentTurns, repairToolPairs, seedMessages } from "./memory";
import {
  createAgentModels,
  invokeWithFallback,
  roundUsageOf,
  type AgentModelOptions,
  type AgentModels,
} from "./model";
import { TripAgentState, type TripAgentStateValue } from "./state";
import { TRIP_AGENT_TOOLS, bindAgentTools, findAgentTool } from "./tools";
import type { ApprovalDecision, TripAgentHandlers } from "./types";

export type TripAgentNode = typeof START | "refresh" | "tap" | "agent" | "approval" | "tools" | "reply";

/** Lookup rounds per advisor message. After this the model must answer. */
export const MAX_TOOL_ROUNDS = 4;
/** Advisor turns sent to the model on each call. */
const CONTEXT_TURNS = 10;
/** Messages kept in saved memory before the oldest turns are removed. */
const STORED_MESSAGES = 80;
/** Earlier chat lines used to start a thread with no saved memory. */
const SEED_MESSAGES = 12;
/** Tool calls made by a button tap carry this id prefix. */
const TAP_CALL = "tap_";

export type TripAgentDeps = {
  handlers: TripAgentHandlers;
  checkpointer: BaseCheckpointSaver;
  /** YYYY-MM-DD in the agency's time zone, for "10–15 Dec" style questions. */
  today: string;
  /** Trip facts already loading (started with the request). Used by the first refresh. */
  trip?: Promise<TripFacts>;
  /** Earlier chat, loaded only when this trip has no saved agent memory yet. */
  loadHistory?: () => Promise<ChatHistoryMessage[]>;
  meter?: TurnMeter;
  models?: AgentModelOptions;
  /** Builds the bound models. Defaults to Claude; tests pass a scripted model. */
  createModels?: (tools: StructuredToolInterface[]) => AgentModels;
};

/** Nothing saved yet: at most the advisor message this turn just added. */
function isNewThread(messages: readonly BaseMessage[]): boolean {
  return messages.length <= 1 && messages.every((message) => HumanMessage.isInstance(message));
}

function lastToolCalls(messages: readonly BaseMessage[]): ToolCall[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (AIMessage.isInstance(message)) return message.tool_calls ?? [];
  }
  return [];
}

/** Approval cards for calls the model chose that must be confirmed first. */
function approvalsFor(calls: ToolCall[], trip: TripFacts | null): string[] {
  return calls.flatMap((call) => {
    const spec = findAgentTool(call.name);
    const parsed = spec?.schema.safeParse(call.args ?? {});
    const summary = spec?.confirm && parsed?.success ? spec.confirm(parsed.data, trip) : null;
    return summary ? [summary] : [];
  });
}

function parseResult(content: unknown): { ok?: boolean; summary?: string } | null {
  try {
    return typeof content === "string" ? JSON.parse(content) : null;
  } catch {
    return null;
  }
}

/** Compile the trip agent for one turn, bound to this advisor's handlers. */
export function buildTripAgentGraph(deps: TripAgentDeps) {
  let currentTrip: TripFacts | null = null;
  const tools = bindAgentTools(TRIP_AGENT_TOOLS, {
    handlers: deps.handlers,
    meter: deps.meter,
    trip: () => currentTrip,
  });
  const models = deps.createModels?.(tools) ?? createAgentModels(tools, deps.models);
  const toolNode = new ToolNode(tools, { handleToolErrors: true });

  let prefetchedTrip = deps.trip;

  /**
   * Reload the trip so the agent sees saved values. A new thread starts from the
   * earlier chat; an old one drops its oldest turns.
   */
  async function refresh(state: TripAgentStateValue) {
    deps.meter?.mark("memory");
    const tripLoad = prefetchedTrip ?? deps.handlers.getTrip();
    prefetchedTrip = undefined;
    const historyLoad =
      deps.loadHistory && isNewThread(state.messages) ? deps.loadHistory() : Promise.resolve(null);
    const [trip, history] = await Promise.all([tripLoad, historyLoad]);
    deps.meter?.mark("trip");
    currentTrip = trip;

    const seed = history ? seedMessages(history, SEED_MESSAGES) : [];
    if (seed.length > 0) {
      return {
        trip,
        messages: [new RemoveMessage({ id: REMOVE_ALL_MESSAGES }), ...seed, ...state.messages],
      };
    }
    return { trip, messages: pruneOldTurns(state.messages, STORED_MESSAGES) };
  }

  /**
   * A button tap runs its tool directly: the labelled button is the approval.
   * Memory records it as a tap, never as typed text. Messages a node creates need
   * their own ids: in "messages" stream mode LangGraph gives id-less node output one
   * id per run, so the second would replace the first.
   */
  function tap(state: TripAgentStateValue) {
    const action = state.action!;
    return {
      action: null,
      messages: [
        new HumanMessage({ content: `[Tapped] ${action.label}`, id: crypto.randomUUID() }),
        new AIMessage({
          content: "",
          id: crypto.randomUUID(),
          tool_calls: [
            { id: `${TAP_CALL}${crypto.randomUUID()}`, name: action.tool, args: action.args, type: "tool_call" },
          ],
        }),
      ],
    };
  }

  async function agent(state: TripAgentStateValue, config: RunnableConfig) {
    const toolsExhausted = state.toolRounds >= MAX_TOOL_ROUNDS;
    const messages = [
      buildTripInstructions({ trip: state.trip, today: deps.today, toolsExhausted }),
      ...repairToolPairs(recentTurns(state.messages, CONTEXT_TURNS)),
    ];
    const stopModel = deps.meter?.startModelCall();
    const { message, fallback } = await invokeWithFallback(
      toolsExhausted ? models.answerOnly : models.withTools,
      messages,
      config,
    ).finally(() => stopModel?.());
    deps.meter?.addRound(roundUsageOf(message, fallback));
    return { messages: [message] };
  }

  /**
   * Pause for the advisor before a risky change the model chose from typed text.
   * Nothing is saved before the pause: on resume this node runs again from the top.
   */
  function approval(state: TripAgentStateValue) {
    const calls = lastToolCalls(state.messages);
    const summaries = approvalsFor(calls, state.trip);
    const first = calls.find((call) => findAgentTool(call.name)?.confirm);
    const decision = interrupt<AgentApproval, ApprovalDecision>({
      tool: first?.name ?? calls[0]!.name,
      args: first?.args ?? {},
      summary: summaries.join(" "),
      tripVersion: state.trip?.version ?? null,
    });
    if (decision === "approve") return new Command({ goto: "tools" });

    const status = decision === "expired" ? "expired: ask again if still wanted" : "cancelled_by_advisor";
    return new Command({
      goto: "agent",
      update: {
        messages: calls.map(
          (call) =>
            new ToolMessage({
              id: crypto.randomUUID(),
              tool_call_id: call.id!,
              name: call.name,
              content: JSON.stringify({ status }),
            }),
        ),
      },
    });
  }

  async function runTools(state: TripAgentStateValue, config: RunnableConfig) {
    const calls = lastToolCalls(state.messages);
    const result = (await toolNode.invoke(state, config)) as { messages: BaseMessage[] };
    const tapped = calls.length === 1 && calls[0]!.id?.startsWith(TAP_CALL);
    const quick = tapped && findAgentTool(calls[0]!.name)?.quickReply;
    const outcome = quick ? parseResult(result.messages[0]?.content) : null;
    return {
      ...result,
      toolRounds: state.toolRounds + 1,
      quickReply: outcome?.ok && outcome.summary ? `${outcome.summary}.` : null,
    };
  }

  function reply(state: TripAgentStateValue) {
    return {
      quickReply: null,
      messages: [new AIMessage({ content: state.quickReply ?? "", id: crypto.randomUUID() })],
    };
  }

  function afterAgent(state: TripAgentStateValue) {
    const calls = lastToolCalls(state.messages);
    if (calls.length === 0) return END;
    return approvalsFor(calls, state.trip).length > 0 ? "approval" : "tools";
  }

  /** A quick reply ends a simple tap; a change reloads the trip; a lookup goes back to the model. */
  function afterTools(state: TripAgentStateValue) {
    if (state.quickReply) return "reply";
    const changed = lastToolCalls(state.messages).some((call) => findAgentTool(call.name)?.risk !== "read");
    return changed ? "refresh" : "agent";
  }

  return new StateGraph(TripAgentState)
    .addNode("refresh", refresh)
    .addNode("tap", tap)
    .addNode("agent", agent)
    .addNode("approval", approval, { ends: ["tools", "agent"] })
    .addNode("tools", runTools)
    .addNode("reply", reply)
    .addEdge(START, "refresh")
    .addConditionalEdges("refresh", (state) => (state.action ? "tap" : "agent"), ["tap", "agent"])
    .addEdge("tap", "tools")
    .addConditionalEdges("agent", afterAgent, ["tools", "approval", END])
    .addConditionalEdges("tools", afterTools, ["reply", "refresh", "agent"])
    .addEdge("reply", END)
    .compile({ checkpointer: deps.checkpointer, name: "trip_agent" });
}

export type TripAgentGraph = ReturnType<typeof buildTripAgentGraph>;
