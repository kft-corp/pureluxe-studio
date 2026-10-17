import { describe, expect, it } from "vitest";

import { DECLINE_LABELS, DECLINE_REPLIES, readReply } from "@/components/trip-builder/offer-reply";
import type { Offer } from "@/components/trip-builder/trip-builder-helpers";

const DATES: Offer = { type: "trip-dates", dates: { checkIn: "2026-10-10", checkOut: "2026-10-20" } };

describe("decline wording", () => {
  it("has a no chip and a no reply for every question", () => {
    expect(Object.keys(DECLINE_REPLIES).sort()).toEqual(Object.keys(DECLINE_LABELS).sort());
    for (const text of [...Object.values(DECLINE_LABELS), ...Object.values(DECLINE_REPLIES)]) {
      expect(text.trim()).not.toBe("");
    }
  });
});

describe("readReply", () => {
  it("is null with no open question", () => {
    expect(readReply(null, "yes")).toBeNull();
  });

  it.each(["yes", "Okay!", "go ahead"])("%j confirms", (message) => {
    expect(readReply(DATES, message)).toEqual({ kind: "confirm" });
  });

  it.each(["no", "cancel", "Nope."])("%j declines with the question's reply", (message) => {
    expect(readReply(DATES, message)).toEqual({
      kind: "decline",
      reply: "Okay. The trip dates stay as they are.",
    });
  });

  it("uses the reply for the open question", () => {
    expect(readReply({ type: "options-preview" }, "no")).toEqual({
      kind: "decline",
      reply: "Okay. I won't open the options quote.",
    });
  });

  it.each(["okay, what is the visa?", "no thanks, search rates", "add Ravi"])(
    "%j is not a yes or a no",
    (message) => {
      expect(readReply(DATES, message)).toBeNull();
    },
  );
});
