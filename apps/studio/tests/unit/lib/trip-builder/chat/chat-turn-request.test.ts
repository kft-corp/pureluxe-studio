import type { TripChatMessage } from "@pureluxe/db";
import { tripBuilderChatSendSchema } from "@pureluxe/shared";
import { describe, expect, it } from "vitest";

import { advisorRowFields, agentRequestFromRow } from "@/lib/trip-builder/chat/chat-turn-request";

function row(fields: Pick<TripChatMessage, "kind" | "content" | "payload">): TripChatMessage {
  return {
    id: "m1",
    trip_id: "trip-1",
    channel: "studio",
    team_member_id: "member-1",
    role: "user",
    tool_calls: null,
    mode: null,
    is_demo: false,
    incomplete: false,
    client_request_id: "req-12345678",
    trace_id: null,
    created_at: "2026-10-20T10:00:00.000Z",
    ...fields,
  };
}

describe("tripBuilderChatSendSchema", () => {
  it("reads a body without kind as a typed message (older clients)", () => {
    expect(
      tripBuilderChatSendSchema.parse({ message: " Trip for Mehta ", client_request_id: "req-12345678" }),
    ).toEqual({ kind: "message", message: "Trip for Mehta", client_request_id: "req-12345678" });
  });

  it("accepts a button action with default args", () => {
    expect(
      tripBuilderChatSendSchema.parse({
        kind: "action",
        action: "trip_get",
        label: "What's missing before booking?",
        client_request_id: "req-12345678",
      }),
    ).toMatchObject({ kind: "action", action: "trip_get", args: {} });
  });

  it("rejects an action name that isn't a tool name", () => {
    expect(() =>
      tripBuilderChatSendSchema.parse({
        kind: "action",
        action: "Drop table",
        label: "x",
        client_request_id: "req-12345678",
      }),
    ).toThrow("Unknown action.");
  });
});

describe("advisor rows and agent requests", () => {
  it("stores a typed message as text and reads it back", () => {
    const fields = advisorRowFields({
      kind: "message",
      message: "Trip for Mehta",
      client_request_id: "req-12345678",
    });
    expect(fields).toEqual({ kind: "text", content: "Trip for Mehta", payload: null });
    expect(agentRequestFromRow(row(fields))).toEqual({ kind: "message", text: "Trip for Mehta" });
  });

  it("stores a tap as an action row and reads it back as the same action", () => {
    const fields = advisorRowFields({
      kind: "action",
      action: "history_search_trips",
      args: { client_id: "c1" },
      label: "Past trips for Aarav",
      client_request_id: "req-12345678",
    });
    expect(fields).toEqual({
      kind: "action",
      content: "Past trips for Aarav",
      payload: { action: "history_search_trips", args: { client_id: "c1" } },
    });
    expect(agentRequestFromRow(row(fields))).toEqual({
      kind: "action",
      action: { tool: "history_search_trips", args: { client_id: "c1" }, label: "Past trips for Aarav" },
    });
  });

  it("stores an approval as an action row and reads it back as a resume", () => {
    const fields = advisorRowFields({
      kind: "resume",
      decision: "cancel",
      label: "Cancel",
      client_request_id: "req-12345678",
    });
    expect(agentRequestFromRow(row(fields))).toEqual({ kind: "resume", decision: "cancel" });
  });

  it("stores how the server settled an approval that went stale", () => {
    const fields = advisorRowFields(
      { kind: "resume", decision: "approve", label: "Confirm", client_request_id: "req-12345678" },
      "expired",
    );
    expect(fields.payload).toEqual({ resume: "expired" });
    expect(agentRequestFromRow(row(fields))).toEqual({ kind: "resume", decision: "expired" });
  });

  it("reads a chip line (no agent action) as plain text", () => {
    expect(
      agentRequestFromRow(row({ kind: "action", content: "Save stay", payload: { via: "chip" } })),
    ).toEqual({ kind: "message", text: "Save stay" });
  });
});
