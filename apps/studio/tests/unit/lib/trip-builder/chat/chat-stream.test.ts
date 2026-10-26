import type { AgentStreamChunk } from "@pureluxe/ai";
import { tripMessages } from "@pureluxe/shared";
import { describe, expect, it, vi } from "vitest";

import { createChatStream } from "@/lib/trip-builder/chat/chat-stream";
import type { ChatMessage, ChatStreamEvent, PreparedChatTurn } from "@/lib/trip-builder";

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<ChatStreamEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatStreamEvent);
}

const USER: ChatMessage = {
  id: "u1",
  role: "user",
  kind: "text",
  content: "Do we have the Mehtas?",
  incomplete: false,
  client_request_id: "req-12345678",
  created_at: "2026-10-20T10:00:00.000Z",
};

describe("createChatStream", () => {
  it("sends one busy event when another reply holds the trip", async () => {
    const events = await readEvents(
      createChatStream({ kind: "busy", message: tripMessages.error.agentBusy }),
    );
    expect(events).toEqual([{ type: "busy", message: tripMessages.error.agentBusy }]);
  });

  it("forwards progress labels and finishes the turn", async () => {
    const prepared = streamTurn([
      { kind: "status", phase: "looking_up" },
      { kind: "progress", label: "Searching clients…" },
      { kind: "delta", text: "Four Mehtas." },
    ]);

    const events = await readEvents(createChatStream(prepared));

    expect(events.map((event) => event.type)).toEqual(["meta", "status", "progress", "delta", "done"]);
    expect(events[2]).toEqual({ type: "progress", label: "Searching clients…" });
    expect(prepared.complete).toHaveBeenCalledWith("Four Mehtas.", {
      undo: false,
      choices: [],
      rateCompare: null,
      legSplit: null,
      approval: null,
    });
    expect(prepared.finish).toHaveBeenCalledWith({ status: "ok" });
  });

  it("tells the browser about each change and saves the cards with the reply", async () => {
    const approval = { tool: "trip_shift_dates", args: { days: 2 }, summary: "Move the trip?", tripVersion: 4 };
    const prepared = streamTurn([
      { kind: "changed", summary: "Dates set", undo: true },
      { kind: "delta", text: "Dates set. Moving the trip needs your OK." },
      { kind: "approval", approval },
    ]);

    const events = await readEvents(createChatStream(prepared));

    expect(events.map((event) => event.type)).toEqual(["meta", "changed", "delta", "done"]);
    expect(events[1]).toEqual({ type: "changed", summary: "Dates set" });
    expect(prepared.complete).toHaveBeenCalledWith("Dates set. Moving the trip needs your OK.", {
      undo: true,
      choices: [],
      rateCompare: null,
      legSplit: null,
      approval,
    });
  });
});

function streamTurn(items: AgentStreamChunk[]) {
  async function* chunks() {
    yield* items;
  }
  const assistant: ChatMessage = { ...USER, id: "a1", role: "assistant", content: "reply" };
  return {
    kind: "stream",
    user: USER,
    chunks: chunks(),
    complete: vi.fn(async () => assistant),
    abandon: vi.fn(async () => null),
    abort: vi.fn(),
    budgetHit: () => false,
    finish: vi.fn(async () => {}),
  } satisfies PreparedChatTurn;
}
