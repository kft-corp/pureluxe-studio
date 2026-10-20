import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";
import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";

import { MAX_TOOL_ROUNDS, buildTripAgentGraph } from "../../../src/agent/graph";
import type { AgentModels } from "../../../src/agent/model";
import { createTurnMeter } from "../../../src/tools";
import { CLIENT_ID, makeHandlers, makeTripFacts } from "../../fixtures/agent";

type Reply = AIMessage | (() => never);

/** A model that answers from a script and records what it was sent. */
function scripted(replies: Reply[]) {
  const calls: BaseMessage[][] = [];
  const model = RunnableLambda.from(async (messages: BaseMessage[]) => {
    calls.push(messages);
    const next = replies.shift();
    if (!next) throw new Error("Script ran out of replies.");
    return typeof next === "function" ? next() : next;
  });
  return { model, calls };
}

function toolCall(name: string, args: Record<string, unknown>, id = `call_${name}`) {
  return new AIMessage({ content: "", tool_calls: [{ id, name, args, type: "tool_call" }] });
}

function setup(options: {
  withTools: Reply[];
  answerOnly?: Reply[];
  fallback?: Reply[];
}) {
  const handlers = makeHandlers();
  const meter = createTurnMeter();
  const primary = scripted(options.withTools);
  const answerOnly = scripted(options.answerOnly ?? []);
  const fallback = options.fallback ? scripted(options.fallback) : null;
  const models: AgentModels = {
    primaryName: "test-model",
    withTools: { primary: primary.model, fallback: fallback?.model ?? null },
    answerOnly: { primary: answerOnly.model, fallback: null },
  };
  const graph = buildTripAgentGraph({
    handlers,
    checkpointer: new MemorySaver(),
    today: "2026-10-20",
    meter,
    createModels: () => models,
  });
  const config = { configurable: { thread_id: "trip:trip-1" } };
  return { graph, config, handlers, meter, primary, answerOnly, fallback };
}

describe("trip agent graph", () => {
  it("answers a question with a lookup, using the saved trip as facts", async () => {
    const { graph, config, handlers, meter, primary } = setup({
      withTools: [toolCall("client_search", { query: "Mehta" }), new AIMessage("Four Mehtas on file.")],
    });

    const state = await graph.invoke(
      { messages: [new HumanMessage("Do we have the Mehtas?")], action: null, toolRounds: 0 },
      config,
    );

    expect(handlers.getTrip).toHaveBeenCalledOnce();
    expect(handlers.searchClients).toHaveBeenCalledWith({ query: "Mehta", limit: undefined });
    expect(state.messages.at(-1)?.text).toBe("Four Mehtas on file.");
    expect(state.toolRounds).toBe(1);

    const [system] = primary.calls[0]!;
    expect(system).toBeInstanceOf(SystemMessage);
    expect(JSON.stringify(system!.content)).toContain("Today: 2026-10-20");
    expect(JSON.stringify(system!.content)).toContain("Mehta · Maldives");
    expect(meter.read()).toMatchObject({ rounds: 2, toolCalls: [expect.objectContaining({ name: "client_search" })] });
  });

  it("uses trip facts already loading instead of loading them again", async () => {
    const handlers = makeHandlers();
    const preloaded = makeTripFacts({ title: "Preloaded trip" });
    const primary = scripted([new AIMessage("Done.")]);
    const graph = buildTripAgentGraph({
      handlers,
      checkpointer: new MemorySaver(),
      today: "2026-10-20",
      trip: Promise.resolve(preloaded),
      createModels: () => ({
        primaryName: "test-model",
        withTools: { primary: primary.model, fallback: null },
        answerOnly: { primary: primary.model, fallback: null },
      }),
    });

    const state = await graph.invoke(
      { messages: [new HumanMessage("hello")], action: null, toolRounds: 0 },
      { configurable: { thread_id: "trip:trip-1" } },
    );

    expect(handlers.getTrip).not.toHaveBeenCalled();
    expect(state.trip?.title).toBe("Preloaded trip");
  });

  it("runs a button tap's tool directly and records it as a tap", async () => {
    const { graph, config, handlers, primary } = setup({
      withTools: [new AIMessage("Two past trips.")],
    });

    const state = await graph.invoke(
      {
        messages: [],
        action: { tool: "history_search_trips", args: { client_id: CLIENT_ID }, label: "Past trips for Aarav" },
        toolRounds: 0,
      },
      config,
    );

    expect(handlers.searchTrips).toHaveBeenCalledWith(expect.objectContaining({ clientId: CLIENT_ID }));
    expect(primary.calls).toHaveLength(1);
    expect(state.action).toBeNull();
    expect(state.messages[0]?.text).toBe("[Tapped] Past trips for Aarav");
    expect((state.messages[1] as AIMessage).tool_calls?.[0]?.name).toBe("history_search_trips");
    expect(state.messages[2]).toBeInstanceOf(ToolMessage);
    expect(state.messages.at(-1)?.text).toBe("Two past trips.");
  });

  it("makes the model answer once the lookup limit is reached", async () => {
    const lookups = Array.from({ length: MAX_TOOL_ROUNDS }, (_, index) =>
      toolCall("trip_get", {}, `call_${index}`),
    );
    const { graph, config, primary, answerOnly } = setup({
      withTools: lookups,
      answerOnly: [new AIMessage("Here is what I found.")],
    });

    const state = await graph.invoke(
      { messages: [new HumanMessage("Check everything")], action: null, toolRounds: 0 },
      config,
    );

    expect(primary.calls).toHaveLength(MAX_TOOL_ROUNDS);
    expect(answerOnly.calls).toHaveLength(1);
    expect(state.messages.at(-1)?.text).toBe("Here is what I found.");
  });

  it("starts each turn's lookup count again and keeps earlier turns in memory", async () => {
    const { graph, config } = setup({
      withTools: [new AIMessage("First."), new AIMessage("Second.")],
    });

    await graph.invoke({ messages: [new HumanMessage("one")], action: null, toolRounds: 0 }, config);
    const state = await graph.invoke(
      { messages: [new HumanMessage("two")], action: null, toolRounds: 0 },
      config,
    );

    expect(state.messages.map((message) => message.text)).toEqual(["one", "First.", "two", "Second."]);
  });

  it("uses the backup model when the main one is overloaded", async () => {
    const overloaded = () => {
      throw Object.assign(new Error("overloaded"), { status: 529 });
    };
    const { graph, config, meter, fallback } = setup({
      withTools: [overloaded],
      fallback: [new AIMessage("Answered by the backup.")],
    });

    const state = await graph.invoke(
      { messages: [new HumanMessage("hello")], action: null, toolRounds: 0 },
      config,
    );

    expect(fallback?.calls).toHaveLength(1);
    expect(state.messages.at(-1)?.text).toBe("Answered by the backup.");
    expect(meter.read().fallbackUsed).toBe(true);
  });

  it("does not hide a bad request behind the backup model", async () => {
    const badRequest = () => {
      throw Object.assign(new Error("bad request"), { status: 400 });
    };
    const { graph, config, fallback } = setup({
      withTools: [badRequest],
      fallback: [new AIMessage("never")],
    });

    await expect(
      graph.invoke({ messages: [new HumanMessage("hello")], action: null, toolRounds: 0 }, config),
    ).rejects.toThrow("bad request");
    expect(fallback?.calls).toHaveLength(0);
  });
});
