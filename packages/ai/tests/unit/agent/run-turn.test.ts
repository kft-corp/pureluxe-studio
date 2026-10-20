import type { BaseMessage } from "@langchain/core/messages";
import { FakeListChatModel } from "@langchain/core/utils/testing";
import { MemorySaver } from "@langchain/langgraph";
import { tripMessages } from "@pureluxe/shared";
import { describe, expect, it, vi } from "vitest";

import type { AgentModels } from "../../../src/agent/model";
import { REDACTED } from "../../../src/agent/redact";
import { streamTripAgentTurn, type TripAgentTurnInput } from "../../../src/agent/run-turn";
import { createTurnMeter, type AgentStreamChunk } from "../../../src/tools";
import { makeHandlers } from "../../fixtures/agent";

function modelsReplying(...responses: string[]): () => AgentModels {
  const model = new FakeListChatModel({ responses });
  const pair = { primary: model as unknown as AgentModels["withTools"]["primary"], fallback: null };
  return () => ({ primaryName: "fake", withTools: pair, answerOnly: pair });
}

function turnInput(overrides: Partial<TripAgentTurnInput> = {}): TripAgentTurnInput {
  return {
    tripId: "trip-1",
    request: { kind: "message", text: "Do we have the Mehtas?" },
    handlers: makeHandlers(),
    checkpointer: new MemorySaver(),
    today: "2026-10-20",
    meter: createTurnMeter(),
    createModels: modelsReplying("Four Mehtas on file."),
    ...overrides,
  };
}

async function collect(input: TripAgentTurnInput): Promise<AgentStreamChunk[]> {
  const chunks: AgentStreamChunk[] = [];
  for await (const chunk of streamTripAgentTurn(input)) chunks.push(chunk);
  return chunks;
}

const replyText = (chunks: AgentStreamChunk[]) =>
  chunks.flatMap((chunk) => (chunk.kind === "delta" ? [chunk.text] : [])).join("");

describe("streamTripAgentTurn", () => {
  it("streams the reply once, starting with thinking", async () => {
    const meter = createTurnMeter();
    const chunks = await collect(turnInput({ meter }));

    expect(chunks[0]).toEqual({ kind: "status", phase: "thinking" });
    expect(chunks).toContainEqual({ kind: "status", phase: "writing" });
    expect(replyText(chunks)).toBe("Four Mehtas on file.");
    expect(meter.read().ttftMs).not.toBeNull();
  });

  it("saves the advisor's message without sensitive data", async () => {
    const checkpointer = new MemorySaver();
    await collect(
      turnInput({ checkpointer, request: { kind: "message", text: "Passport number: K1234567" } }),
    );

    const saved = await checkpointer.getTuple({ configurable: { thread_id: "trip:trip-1" } });
    const messages = saved?.checkpoint.channel_values.messages as BaseMessage[];
    expect(messages[0]?.text).toBe(`Passport number: ${REDACTED}`);
  });

  it("starts memory from earlier chat only for a new thread", async () => {
    const checkpointer = new MemorySaver();
    const loadHistory = vi.fn(async () => [
      { role: "user" as const, content: "Trip for Mehta" },
      { role: "assistant" as const, content: "Which Mehta?" },
    ]);

    await collect(turnInput({ checkpointer, loadHistory }));
    await collect(turnInput({ checkpointer, loadHistory, createModels: modelsReplying("Second.") }));

    expect(loadHistory).toHaveBeenCalledOnce();
    const saved = await checkpointer.getTuple({ configurable: { thread_id: "trip:trip-1" } });
    const messages = saved?.checkpoint.channel_values.messages as BaseMessage[];
    expect(messages.map((message) => message.text)).toEqual([
      "Trip for Mehta",
      "Which Mehta?",
      "Do we have the Mehtas?",
      "Four Mehtas on file.",
      "Do we have the Mehtas?",
      "Second.",
    ]);
  });

  it("reads saved memory once for a normal message", async () => {
    const checkpointer = new MemorySaver();
    await collect(turnInput({ checkpointer }));
    const reads = vi.spyOn(checkpointer, "getTuple");

    await collect(turnInput({ checkpointer, createModels: modelsReplying("Second.") }));

    expect(reads).toHaveBeenCalledTimes(1);
  });

  it("keeps the tap line in memory while streaming (own ids, not one per node run)", async () => {
    const checkpointer = new MemorySaver();
    await collect(
      turnInput({
        checkpointer,
        request: { kind: "action", action: { tool: "trip_get", args: {}, label: "What's missing?" } },
      }),
    );

    const saved = await checkpointer.getTuple({ configurable: { thread_id: "trip:trip-1" } });
    const messages = saved?.checkpoint.channel_values.messages as BaseMessage[];
    expect(messages.map((message) => message.getType())).toEqual(["human", "ai", "tool", "ai"]);
    expect(messages[0]?.text).toBe("[Tapped] What's missing?");
  });

  it("starts memory from earlier chat for a first tap too, before the tap", async () => {
    const checkpointer = new MemorySaver();
    await collect(
      turnInput({
        checkpointer,
        request: { kind: "action", action: { tool: "trip_get", args: {}, label: "What's missing?" } },
        loadHistory: async () => [
          { role: "user", content: "Trip for Mehta" },
          { role: "assistant", content: "Which Mehta?" },
        ],
      }),
    );

    const saved = await checkpointer.getTuple({ configurable: { thread_id: "trip:trip-1" } });
    const messages = saved?.checkpoint.channel_values.messages as BaseMessage[];
    expect(messages.slice(0, 3).map((message) => message.text)).toEqual([
      "Trip for Mehta",
      "Which Mehta?",
      "[Tapped] What's missing?",
    ]);
  });

  it("refuses a tap for an action the agent doesn't have", async () => {
    await expect(
      collect(
        turnInput({
          request: { kind: "action", action: { tool: "quote_send", args: {}, label: "Send" } },
        }),
      ),
    ).rejects.toMatchObject({ userMessage: tripMessages.error.agentActionUnavailable });
  });

  it("refuses an approval when nothing is waiting", async () => {
    await expect(
      collect(turnInput({ request: { kind: "resume", decision: "approve" } })),
    ).rejects.toMatchObject({ code: "ai.no_pending_approval", status: 409 });
  });

  it("fails clearly when the model writes nothing", async () => {
    await expect(collect(turnInput({ createModels: modelsReplying("") }))).rejects.toMatchObject({
      code: "ai.provider_failed",
    });
  });
});
