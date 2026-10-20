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
    async function* chunks() {
      yield { kind: "status" as const, phase: "looking_up" as const };
      yield { kind: "progress" as const, label: "Searching clients…" };
      yield { kind: "delta" as const, text: "Four Mehtas." };
    }
    const assistant: ChatMessage = { ...USER, id: "a1", role: "assistant", content: "Four Mehtas." };
    const prepared: PreparedChatTurn = {
      kind: "stream",
      user: USER,
      chunks: chunks(),
      complete: vi.fn(async () => assistant),
      abandon: vi.fn(async () => null),
      abort: vi.fn(),
      finish: vi.fn(async () => {}),
    };

    const events = await readEvents(createChatStream(prepared));

    expect(events.map((event) => event.type)).toEqual(["meta", "status", "progress", "delta", "done"]);
    expect(events[2]).toEqual({ type: "progress", label: "Searching clients…" });
    expect(prepared.complete).toHaveBeenCalledWith("Four Mehtas.");
    expect(prepared.finish).toHaveBeenCalledWith({ status: "ok" });
  });
});
