import { claudeRoundUsage, createTurnMeter, type ModelRoundUsage } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ insertAgentTurn: vi.fn() }));

vi.mock("@pureluxe/db", () => ({ insertAgentTurn: db.insertAgentTurn }));

import { recordAgentTurn } from "@/lib/trip-builder/chat/record-agent-turn";

type ClaudeMessage = Parameters<typeof claudeRoundUsage>[0];

function message(usage: Partial<ClaudeMessage["usage"]>): ModelRoundUsage {
  return claudeRoundUsage({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-test",
    content: [],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      ...usage,
    },
  } as ClaudeMessage);
}

function clock(times: number[]) {
  let index = 0;
  return () => times[Math.min(index++, times.length - 1)]!;
}

describe("createTurnMeter", () => {
  it("sums tokens across rounds and measures first text and total time", () => {
    const meter = createTurnMeter(clock([1000, 1400, 1450, 2200]));
    meter.markText();
    meter.markText();
    meter.addRound(message({ input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 900 }));
    meter.addRound(message({ input_tokens: 50, output_tokens: 30, cache_creation_input_tokens: 40 }));
    meter.addToolCall({ name: "get_trip", ms: 12, ok: true, error_code: null });

    expect(meter.read()).toEqual({
      model: "claude-test",
      rounds: 2,
      toolCalls: [{ name: "get_trip", ms: 12, ok: true, error_code: null }],
      inputTokens: 150,
      outputTokens: 50,
      cacheReadTokens: 900,
      cacheWriteTokens: 40,
      fallbackUsed: false,
      ttftMs: 400,
      prepMs: null,
      modelMs: 0,
      prepSteps: {},
      totalMs: 450,
    });
  });

  it("splits preparation time from model time", () => {
    // start 0 · access 120 · trip 900 · model 1000–1600 · model 1700–2000 · read 2100
    const meter = createTurnMeter(clock([0, 120, 900, 1000, 1600, 1700, 2000, 2100]));
    meter.mark("access");
    meter.mark("trip");
    const first = meter.startModelCall();
    first();
    first();
    const second = meter.startModelCall();
    second();

    expect(meter.read()).toMatchObject({
      prepMs: 1000,
      modelMs: 900,
      prepSteps: { access: 120, trip: 900 },
      totalMs: 2100,
    });
  });

  it("flags the turn when the backup model answered a round", () => {
    const meter = createTurnMeter(clock([0, 100]));
    meter.addRound({ ...message({ input_tokens: 5 }), fallback: false });
    meter.addRound({ ...message({ input_tokens: 5 }), model: "claude-backup", fallback: true });

    expect(meter.read()).toMatchObject({ model: "claude-backup", rounds: 2, fallbackUsed: true });
  });

  it("has no time to first text when nothing streamed", () => {
    const meter = createTurnMeter(clock([0, 300]));
    expect(meter.read()).toMatchObject({ model: null, rounds: 0, ttftMs: null, totalMs: 300 });
  });
});

describe("recordAgentTurn", () => {
  beforeEach(() => {
    db.insertAgentTurn.mockReset();
  });

  it("saves a v1 trip row with the error code", async () => {
    const meter = createTurnMeter(clock([0, 250]));
    meter.addRound(message({ input_tokens: 10, output_tokens: 5 }));

    await recordAgentTurn({
      meter,
      outcome: {
        status: "error",
        cause: new AppError({ userMessage: "x", code: "ai.provider_failed", status: 502 }),
      },
      channel: "trip",
      tripId: "trip-1",
      memberId: "member-1",
      clientRequestId: "req-1",
    });

    expect(db.insertAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: "trip-1",
        member_id: "member-1",
        channel: "trip",
        agent_version: "v1",
        client_request_id: "req-1",
        model: "claude-test",
        rounds: 1,
        input_tokens: 10,
        output_tokens: 5,
        status: "error",
        error_code: "ai.provider_failed",
      }),
    );
  });

  it("saves a v2 row with its thread, instructions version and backup-model use", async () => {
    const meter = createTurnMeter(clock([0, 250]));
    meter.addRound({ ...message({ input_tokens: 10 }), model: "claude-backup", fallback: true });

    await recordAgentTurn({
      meter,
      outcome: { status: "ok" },
      channel: "trip",
      tripId: "trip-1",
      memberId: "member-1",
      clientRequestId: "req-1",
      agentVersion: "v2",
      threadId: "trip:trip-1",
      promptVersion: "TRIP_PROMPT_V2",
    });

    expect(db.insertAgentTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_version: "v2",
        thread_id: "trip:trip-1",
        prompt_version: "TRIP_PROMPT_V2",
        model: "claude-backup",
        fallback_used: true,
        error_code: null,
      }),
    );
  });

  it("never throws when the insert fails", async () => {
    db.insertAgentTurn.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      recordAgentTurn({
        meter: createTurnMeter(),
        outcome: { status: "ok" },
        channel: "home",
        tripId: null,
        memberId: "member-1",
        clientRequestId: null,
      }),
    ).resolves.toBeUndefined();

    spy.mockRestore();
  });
});
