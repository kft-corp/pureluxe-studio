import type { AgentStreamChunk } from "@pureluxe/ai";
import type { TripBuilderPreTripChatSendInput } from "@pureluxe/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatStreamEvent } from "@/lib/trip-builder";

const agent = vi.hoisted(() => ({
  chunks: [] as AgentStreamChunk[],
  saveTripChatLines: vi.fn(),
  recordAgentTurn: vi.fn(),
}));

vi.mock("@pureluxe/ai", async (original) => ({
  ...(await original<typeof import("@pureluxe/ai")>()),
  streamHomeAgentTurn: async function* () {
    yield* agent.chunks;
  },
}));
vi.mock("@/lib/ai/create-home-agent-tools", () => ({ createHomeAgentTools: vi.fn() }));
vi.mock("@/lib/trip-builder/chat/chat", () => ({ saveTripChatLines: agent.saveTripChatLines }));
vi.mock("@/lib/trip-builder/chat/record-agent-turn", () => ({ recordAgentTurn: agent.recordAgentTurn }));

import { createPreTripChatStream } from "@/lib/trip-builder/chat/pre-trip-chat";

const ACTOR = { memberId: "member-1", permissions: [] };
const REQUEST: TripBuilderPreTripChatSendInput = {
  kind: "message",
  message: "Mehta family, Maldives 15–20 Dec",
  history: [{ role: "assistant", content: "Who is the trip for?" }],
  client_request_id: "send-12345678",
};

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<ChatStreamEvent[]> {
  const text = await new Response(stream).text();
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatStreamEvent);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPreTripChatStream", () => {
  it("moves the conversation into a trip it created, then opens it", async () => {
    agent.chunks = [
      { kind: "delta", text: "Trip created for Ravi." },
      { kind: "opened", tripId: "trip-new", created: true },
    ];

    const events = await readEvents(createPreTripChatStream(REQUEST, ACTOR));

    expect(events.map((event) => event.type)).toEqual(["meta", "delta", "done", "opened"]);
    expect(events.at(-1)).toEqual({ type: "opened", tripId: "trip-new", created: true });
    expect(agent.saveTripChatLines).toHaveBeenCalledWith(
      "trip-new",
      [
        { role: "assistant", kind: "text", content: "Who is the trip for?" },
        { role: "user", kind: "text", content: "Mehta family, Maldives 15–20 Dec" },
        { role: "assistant", kind: "text", content: "Trip created for Ravi." },
      ],
      ACTOR,
    );
    expect(agent.recordAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "home", tripId: null, outcome: { status: "ok" } }),
    );
  });

  it("opens an existing trip without copying anything, and keeps the reply's buttons", async () => {
    const choices = [{ label: "Open Maldives", action: "trip_open", args: { trip_id: "trip-1" } }];
    agent.chunks = [
      { kind: "delta", text: "Ravi has a trip on those dates." },
      { kind: "choices", choices },
    ];

    const events = await readEvents(createPreTripChatStream(REQUEST, ACTOR));

    expect(events.map((event) => event.type)).toEqual(["meta", "delta", "done"]);
    expect(events[2]).toMatchObject({ type: "done", assistant: { cards: { choices } } });
    expect(agent.saveTripChatLines).not.toHaveBeenCalled();
  });
});
