import type { TripChatMessage } from "@pureluxe/db";
import { describe, expect, it } from "vitest";

import { toChatHistory } from "@/lib/trip-builder/chat/chat-history";

function row(partial: Partial<TripChatMessage> & Pick<TripChatMessage, "id" | "role" | "content">) {
  return {
    trip_id: "trip-1",
    channel: "studio",
    team_member_id: null,
    kind: "text",
    payload: null,
    tool_calls: null,
    mode: null,
    is_demo: false,
    incomplete: false,
    client_request_id: null,
    trace_id: null,
    created_at: "2026-10-20T10:00:00.000Z",
    ...partial,
  } satisfies TripChatMessage;
}

describe("toChatHistory", () => {
  it("marks taps as taps and leaves out the current, unfinished and event rows", () => {
    const history = toChatHistory(
      [
        row({ id: "1", role: "user", content: "Trip for Mehta" }),
        row({ id: "2", role: "user", kind: "action", content: "Save stay · Maldives" }),
        row({ id: "3", role: "assistant", content: "Saved.", kind: "event" }),
        row({ id: "4", role: "assistant", content: "Half a reply", incomplete: true }),
        row({ id: "5", role: "user", content: "the new message" }),
      ],
      "5",
    );

    expect(history).toEqual([
      { role: "user", content: "Trip for Mehta" },
      { role: "user", content: "[Tapped] Save stay · Maldives" },
    ]);
  });
});
