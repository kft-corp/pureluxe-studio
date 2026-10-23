import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";
import { Command, MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";

import { MAX_TOOL_ROUNDS, buildHomeAgentGraph, buildTripAgentGraph } from "../../../src/agent/graph";
import type { AgentModels } from "../../../src/agent/model";
import { createTurnMeter } from "../../../src/tools";
import type { TripFacts } from "../../../src/types";
import {
  CLIENT_ID,
  NEW_TRIP_ID,
  makeBookedTripFacts,
  makeHandlers,
  makeHomeHandlers,
  makeTripFacts,
} from "../../fixtures/agent";

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
  trip?: TripFacts;
}) {
  const handlers = makeHandlers(options.trip);
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

    const first = primary.calls[0]!;
    expect(first[0]).toBeInstanceOf(SystemMessage);
    expect(JSON.stringify(first[0]!.content)).not.toContain("Trip facts");
    expect(first.at(-1)!.text).toContain("Today: 2026-10-20");
    expect(first.at(-1)!.text).toContain("Mehta · Maldives");
    expect(meter.read()).toMatchObject({ rounds: 2, toolCalls: [expect.objectContaining({ name: "client_search" })] });
  });

  it("sends the trip facts after the conversation, with a cache breakpoint on the conversation's end", async () => {
    const { graph, config, primary } = setup({
      withTools: [toolCall("client_search", { query: "Mehta" }), new AIMessage("Four Mehtas on file.")],
    });

    await graph.invoke({ messages: [new HumanMessage("Do we have the Mehtas?")], action: null, toolRounds: 0 }, config);

    const second = primary.calls[1]!;
    const toolResult = second.at(-2)!;
    expect(toolResult).toBeInstanceOf(ToolMessage);
    expect(toolResult.content).toEqual([expect.objectContaining({ cache_control: { type: "ephemeral" } })]);
    expect(second.at(-1)!.text).toMatch(/^\[From Studio, not the advisor\]/);
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

  it("makes a change straight away and reloads the trip before answering", async () => {
    const { graph, config, handlers } = setup({
      withTools: [toolCall("trip_set_dates", { start: "12-10", end: "12-15" }), new AIMessage("Dates set.")],
    });

    const state = await graph.invoke(
      { messages: [new HumanMessage("10–15 Dec")], action: null, toolRounds: 0 },
      config,
    );

    expect(handlers.setDates).toHaveBeenCalledWith({ start: "12-10", end: "12-15" }, { id: "call_trip_set_dates" });
    expect(handlers.getTrip).toHaveBeenCalledTimes(2);
    expect(state.messages.at(-1)?.text).toBe("Dates set.");
  });

  it("streams a changed event for the chat", async () => {
    const { graph, config } = setup({
      withTools: [toolCall("trip_set_dates", { start: "12-10", end: "12-15" }), new AIMessage("Dates set.")],
    });

    const custom: unknown[] = [];
    const stream = await graph.stream(
      { messages: [new HumanMessage("10–15 Dec")], action: null, toolRounds: 0 },
      { ...config, streamMode: "custom" },
    );
    for await (const chunk of stream) custom.push(chunk);

    expect(custom).toEqual([{ kind: "changed", summary: "Dates set to 10 Dec – 15 Dec 2026", undo: true }]);
  });

  it("moves a trip with no booking at once, with Undo", async () => {
    const { graph, config, handlers } = setup({
      withTools: [toolCall("trip_shift_dates", { days: 2 }), new AIMessage("Moved.")],
    });

    await graph.invoke({ messages: [new HumanMessage("push it 2 days")], action: null, toolRounds: 0 }, config);

    expect((await graph.getState(config)).next).toEqual([]);
    expect(handlers.shiftDates).toHaveBeenCalledWith({ days: 2 }, { id: "call_trip_shift_dates" });
  });

  it("pauses a change that would cancel a booking until the advisor confirms", async () => {
    const { graph, config, handlers } = setup({
      withTools: [toolCall("trip_shift_dates", { days: 2 }), new AIMessage("Moved.")],
      trip: makeBookedTripFacts(),
    });

    await graph.invoke({ messages: [new HumanMessage("push it 2 days")], action: null, toolRounds: 0 }, config);
    const paused = await graph.getState(config);
    expect(paused.next).toEqual(["approval"]);
    expect(paused.tasks[0]?.interrupts[0]?.value).toMatchObject({
      tool: "trip_shift_dates",
      args: { days: 2 },
      summary: expect.stringMatching(/^Move the whole trip 2 days later\?/),
    });
    expect(handlers.shiftDates).not.toHaveBeenCalled();

    const state = await graph.invoke(new Command({ resume: "approve" }), config);
    expect(handlers.shiftDates).toHaveBeenCalledWith({ days: 2 }, { id: "call_trip_shift_dates" });
    expect(state.messages.at(-1)?.text).toBe("Moved.");
  });

  it("tells the model a cancelled change was not made", async () => {
    const { graph, config, handlers, primary } = setup({
      withTools: [toolCall("trip_shift_dates", { days: 2 }), new AIMessage("Okay, dates unchanged.")],
      trip: makeBookedTripFacts(),
    });

    await graph.invoke({ messages: [new HumanMessage("push it 2 days")], action: null, toolRounds: 0 }, config);
    const state = await graph.invoke(new Command({ resume: "cancel" }), config);

    expect(handlers.shiftDates).not.toHaveBeenCalled();
    expect(JSON.stringify(primary.calls[1]!.at(-2)!.content)).toContain("cancelled_by_advisor");
    expect(state.messages.at(-1)?.text).toBe("Okay, dates unchanged.");
  });

  it("answers an Undo tap from its result, without the model", async () => {
    const { graph, config, handlers, primary } = setup({ withTools: [] });

    const state = await graph.invoke(
      { messages: [], action: { tool: "trip_undo", args: {}, label: "Undo" }, toolRounds: 0 },
      config,
    );

    expect(handlers.undo).toHaveBeenCalledOnce();
    expect(primary.calls).toHaveLength(0);
    expect(state.messages.at(-1)?.text).toBe("Undone: Dates set to 10 Dec – 15 Dec 2026.");
    expect(state.quickReply).toBeNull();
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

describe("home agent graph", () => {
  function setupHome(withTools: Reply[]) {
    const handlers = makeHomeHandlers();
    const primary = scripted(withTools);
    const graph = buildHomeAgentGraph({
      handlers,
      checkpointer: new MemorySaver(),
      today: "2026-10-20",
      createModels: () => ({
        primaryName: "test-model",
        withTools: { primary: primary.model, fallback: null },
        answerOnly: { primary: primary.model, fallback: null },
      }),
    });
    return { graph, handlers, primary, config: { configurable: { thread_id: "home" } } };
  }

  it("creates the trip in one call and opens it, without asking first", async () => {
    const { graph, config, handlers, primary } = setupHome([
      toolCall("trip_create", { client_id: CLIENT_ID, lead: "household_primary", start: "12-15", end: "12-20", stays: [{ city: "Maldives" }] }),
      new AIMessage("Trip created."),
    ]);

    const custom: unknown[] = [];
    const stream = await graph.stream(
      { messages: [new HumanMessage("Mehta family, Maldives 15–20 Dec")], action: null, toolRounds: 0 },
      { ...config, streamMode: "custom" },
    );
    for await (const chunk of stream) custom.push(chunk);

    expect(handlers.createTrip).toHaveBeenCalledWith(
      {
        clientId: CLIENT_ID,
        lead: "household_primary",
        withHousehold: true,
        start: "12-15",
        end: "12-20",
        stays: [expect.objectContaining({ city: "Maldives" })],
        createAnyway: false,
      },
      { id: "call_trip_create" },
    );
    expect(custom).toContainEqual({ kind: "opened", tripId: NEW_TRIP_ID, created: true });
    expect(primary.calls[0]!.at(-1)!.text).not.toContain("Trip facts");
  });

  it("lists upcoming trips instead of creating one, and offers to open the advisor's own", async () => {
    const { graph, config, handlers } = setupHome([
      toolCall("trip_create", { client_id: CLIENT_ID, start: "12-15", end: "12-20" }),
      new AIMessage("Ravi already has a trip on those dates."),
    ]);
    const upcoming = {
      title: "Ravi Mehta · Maldives",
      status: "confirmed",
      starts_on: "2026-12-15",
      ends_on: "2026-12-20",
      destinations: ["Maldives"],
      matches: "dates" as const,
    };
    handlers.createTrip.mockResolvedValueOnce({
      ok: true,
      status: "existing",
      upcoming_trips: [
        { ...upcoming, trip_id: "trip-1", owner_name: null },
        { ...upcoming, trip_id: "trip-2", owner_name: "Keshav" },
      ],
    });

    const custom: unknown[] = [];
    const stream = await graph.stream(
      { messages: [new HumanMessage("Ravi, Maldives 15–20 Dec")], action: null, toolRounds: 0 },
      { ...config, streamMode: "custom" },
    );
    for await (const chunk of stream) custom.push(chunk);

    expect(custom).not.toContainEqual(expect.objectContaining({ kind: "opened" }));
    const choices = custom.find((chunk) => (chunk as { kind: string }).kind === "choices") as {
      choices: Array<{ label: string; action: string; args: Record<string, unknown> }>;
    };
    expect(choices.choices.map((choice) => [choice.label, choice.action])).toEqual([
      ["Open Maldives · 15 Dec – 20 Dec 2026", "trip_open"],
      ["Create a new trip", "trip_create"],
    ]);
    expect(choices.choices[1]!.args).toMatchObject({ client_id: CLIENT_ID, create_anyway: true });
  });
});
