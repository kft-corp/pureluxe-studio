import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";
import {
  END,
  REMOVE_ALL_MESSAGES,
  START,
  StateGraph,
  type BaseCheckpointSaver,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import type { TurnMeter } from "../tools";
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
import type { TripAgentHandlers } from "./types";

export type TripAgentNode = typeof START | "refresh" | "tap" | "agent" | "tools";

/** Lookup rounds per advisor message. After this the model must answer. */
export const MAX_TOOL_ROUNDS = 4;
/** Advisor turns sent to the model on each call. */
const CONTEXT_TURNS = 10;
/** Messages kept in saved memory before the oldest turns are removed. */
const STORED_MESSAGES = 80;
/** Earlier chat lines used to start a thread with no saved memory. */
const SEED_MESSAGES = 12;

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

function lastToolCallNames(messages: readonly BaseMessage[]): string[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]!;
    if (AIMessage.isInstance(message)) return (message.tool_calls ?? []).map((call) => call.name);
  }
  return [];
}

/** Compile the trip agent for one turn, bound to this advisor's handlers. */
export function buildTripAgentGraph(deps: TripAgentDeps) {
  const tools = bindAgentTools(TRIP_AGENT_TOOLS, { handlers: deps.handlers, meter: deps.meter });
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
   * A button tap runs its tool directly. Memory records it as a tap, never as typed text.
   * Messages a node creates need their own ids: in "messages" stream mode LangGraph
   * gives id-less node output one id per run, so the second would replace the first.
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
            { id: `tap_${crypto.randomUUID()}`, name: action.tool, args: action.args, type: "tool_call" },
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

  async function runTools(state: TripAgentStateValue, config: RunnableConfig) {
    const result = await toolNode.invoke(state, config);
    return { ...result, toolRounds: state.toolRounds + 1 };
  }

  /** Read tools leave the trip as it was; anything else reloads it first. */
  function afterTools(state: TripAgentStateValue) {
    const changed = lastToolCallNames(state.messages).some(
      (name) => findAgentTool(name)?.risk !== "read",
    );
    return changed ? "refresh" : "agent";
  }

  function afterAgent(state: TripAgentStateValue) {
    return lastToolCallNames(state.messages).length > 0 ? "tools" : END;
  }

  return new StateGraph(TripAgentState)
    .addNode("refresh", refresh)
    .addNode("tap", tap)
    .addNode("agent", agent)
    .addNode("tools", runTools)
    .addEdge(START, "refresh")
    .addConditionalEdges("refresh", (state) => (state.action ? "tap" : "agent"), ["tap", "agent"])
    .addEdge("tap", "tools")
    .addConditionalEdges("agent", afterAgent, ["tools", END])
    .addConditionalEdges("tools", afterTools, ["refresh", "agent"])
    .compile({ checkpointer: deps.checkpointer, name: "trip_agent" });
}

export type TripAgentGraph = ReturnType<typeof buildTripAgentGraph>;
