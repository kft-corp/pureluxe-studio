import { describe, expect, it } from "vitest";

import { checkStep, type ObservedStep } from "@/tests/ai/eval/checks";
import { newEvalTrip } from "@/tests/ai/eval/eval-trip";

function observed(partial: Partial<ObservedStep> = {}): ObservedStep {
  return {
    reply: "Four Mehtas on file. Which one?",
    tools: ["client_search"],
    memory: "",
    trip: newEvalTrip("trip-1"),
    ...partial,
  };
}

describe("checkStep", () => {
  it("passes when tools, wording and the question all match", () => {
    const result = checkStep(
      {
        tools: { called: ["client_search"], notCalled: ["trip_set_client"] },
        reply: { mentions: ["mehta"], mustNot: ["Start:"], asksQuestion: true },
        confirmations: 0,
      },
      observed(),
      ["database"],
    );
    expect(result).toEqual({ failures: [], notChecked: [] });
  });

  it("reports missing and forbidden tools, and too many calls", () => {
    const { failures } = checkStep(
      {
        tools: { called: ["place_get_notes"], notCalled: ["client_search"], maxCalls: { client_search: 1 } },
      },
      observed({ tools: ["client_search", "client_search"] }),
      [],
    );
    expect(failures).toEqual([
      "expected place_get_notes to be called (called: client_search, client_search)",
      "client_search must not be called",
      "client_search called 2 times (max 1)",
    ]);
  });

  it("checks wording, every-reply bans, the closing question and yes/no prompts", () => {
    const { failures } = checkStep(
      { reply: { mentions: ["Aarav"], asksQuestion: true } },
      observed({ reply: "Saved in the database. Say **yes** to continue." }),
      ["database"],
    );
    expect(failures).toEqual([
      'reply should mention "Aarav"',
      'reply must not contain "database"',
      "reply should end by asking a question",
      "asked for 1 yes/no confirmation(s) (allowed 0)",
    ]);
  });

  it("fails a read-only step that ran a write tool", () => {
    const { failures } = checkStep({ readOnly: true }, observed({ tools: ["quote_send"] }), []);
    expect(failures).toEqual(["read-only step changed something: quote_send"]);
  });

  it("fails when agent memory holds a banned value", () => {
    const { failures } = checkStep(
      { memoryMustNot: ["K1234567"] },
      observed({ memory: "Passport number: K1234567" }),
      [],
    );
    expect(failures).toEqual(['agent memory must not contain "K1234567"']);
  });

  it("lists what this build stage can't check instead of failing", () => {
    const { failures, notChecked } = checkStep(
      { cards: ["client_picker"], approvals: 1, trip: { quoteStatus: "sent" } },
      observed(),
      [],
    );
    expect(failures).toEqual([]);
    expect(notChecked).toEqual(["trip.quoteStatus", "cards (client_picker)", "approvals"]);
  });

  it("compares the trip's dates and stays once write tools change them", () => {
    const trip = { ...newEvalTrip("trip-1"), startsOn: "2026-12-10", endsOn: "2026-12-14" };
    const { failures } = checkStep(
      {
        trip: {
          dates: { start: "2026-12-10", end: "2026-12-15" },
          stays: [{ destination: "Maldives", checkIn: "2026-12-10", checkOut: "2026-12-15" }],
        },
      },
      observed({ trip }),
      [],
    );
    expect(failures).toEqual([
      "trip dates 2026-12-10 to 2026-12-14, expected 2026-12-10 to 2026-12-15",
      'stays "none", expected "Maldives 2026-12-10–2026-12-15"',
    ]);
  });
});
