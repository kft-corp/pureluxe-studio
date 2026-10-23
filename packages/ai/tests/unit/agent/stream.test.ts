import { AIMessage, AIMessageChunk, ToolMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";

import { progressLabels, toAgentChunks } from "../../../src/agent/stream";
import { createTurnMeter, type AgentStreamChunk } from "../../../src/tools";

async function collect(events: unknown[]) {
  async function* stream() {
    yield* events;
  }
  const chunks: AgentStreamChunk[] = [];
  const generator = toAgentChunks(stream(), createTurnMeter());
  let step = await generator.next();
  while (!step.done) {
    chunks.push(step.value);
    step = await generator.next();
  }
  return { chunks, summary: step.value };
}

const agentToken = (text: string) => [
  "messages",
  [new AIMessageChunk({ content: text }), { langgraph_node: "agent" }],
];

describe("progressLabels", () => {
  it("gives one step per distinct lookup, in call order", () => {
    expect(
      progressLabels([
        { name: "client_search", args: { query: "Mehta" } },
        { name: "hotel_get", args: { name: "Resort One" } },
        { name: "hotel_get", args: { name: "Resort Two" } },
      ]),
    ).toEqual(["Finding the client…", "Reviewing hotel details…"]);
  });

  it("falls back for unknown tools or bad arguments", () => {
    expect(progressLabels([{ name: "hotel_get", args: {} }, { name: "nope", args: {} }])).toEqual([
      "Gathering details…",
    ]);
  });

  it("never names internal systems or the brand", () => {
    const labels = progressLabels([
      { name: "place_get_notes", args: { query: "Maldives" } },
      { name: "rates_get_snapshot", args: {} },
      { name: "history_search_trips", args: {} },
    ]);
    for (const label of labels) expect(label).not.toMatch(/atlas|notes|snapshot|search|pureluxe|database/i);
  });
});

describe("toAgentChunks", () => {
  it("streams agent tokens, and reports lookups between rounds", async () => {
    const { chunks, summary } = await collect([
      [
        "updates",
        {
          agent: {
            messages: [
              new AIMessage({
                content: "",
                tool_calls: [{ id: "1", name: "client_search", args: { query: "Mehta" }, type: "tool_call" }],
              }),
            ],
          },
        },
      ],
      ["messages", [new ToolMessage({ content: "{}", tool_call_id: "1" }), { langgraph_node: "tools" }]],
      agentToken("Four "),
      agentToken("Mehtas."),
      ["updates", { agent: { messages: [new AIMessage("Four Mehtas.")] } }],
    ]);

    expect(chunks).toEqual([
      { kind: "status", phase: "looking_up" },
      { kind: "progress", label: "Finding the client…" },
      { kind: "status", phase: "writing" },
      { kind: "delta", text: "Four " },
      { kind: "delta", text: "Mehtas." },
    ]);
    expect(summary).toEqual({ sawText: true, paused: false });
  });

  it("says when the model wrote nothing", async () => {
    const { chunks, summary } = await collect([["updates", { refresh: {} }]]);
    expect(chunks).toEqual([]);
    expect(summary).toEqual({ sawText: false, paused: false });
  });

  it("passes tool events through and turns an interrupt into an approval card", async () => {
    const approval = { tool: "trip_shift_dates", args: { days: 2 }, summary: "Move the trip?", tripVersion: 3 };
    const { chunks, summary } = await collect([
      ["custom", { kind: "changed", summary: "Dates set", undo: true }],
      ["custom", { kind: "opened", tripId: "trip-2", created: true }],
      ["custom", { kind: "something_else" }],
      ["updates", { __interrupt__: [{ value: approval }] }],
    ]);

    expect(chunks).toEqual([
      { kind: "changed", summary: "Dates set", undo: true },
      { kind: "opened", tripId: "trip-2", created: true },
      { kind: "approval", approval },
    ]);
    expect(summary).toEqual({ sawText: false, paused: true });
  });

  it("streams a quick reply written without the model", async () => {
    const { chunks } = await collect([
      ["messages", [new AIMessage("Undone: dates."), { langgraph_node: "reply" }]],
    ]);
    expect(chunks).toEqual([
      { kind: "status", phase: "writing" },
      { kind: "delta", text: "Undone: dates." },
    ]);
  });
});
