import { describe, expect, it } from "vitest";

import {
  mergeStayDraft,
  parseStayMessage,
  partyReady,
  type StayDraft,
} from "@/lib/trip-builder/intents";

const EMPTY: StayDraft = {
  hotel: "",
  city: "",
  checkIn: "",
  checkOut: "",
  adults: null,
  children: null,
  rooms: null,
};

describe("parseStayMessage", () => {
  it("reads the labelled stay template", () => {
    const text = [
      "Hotel: Atlantis",
      "City: Dubai",
      "Check-in: 2026-10-10",
      "Check-out: 2026-10-14",
      "Adults: 2",
      "Children: 0",
      "Rooms: 1",
    ].join("\n");
    expect(parseStayMessage(text)).toEqual({
      hotel: "Atlantis",
      city: "Dubai",
      checkIn: "2026-10-10",
      checkOut: "2026-10-14",
      adults: 2,
      children: 0,
      rooms: 1,
    });
  });

  it("reads the party in rate search", () => {
    expect(parseStayMessage("2 adults, no children, 1 room", { partyOnly: true })).toEqual({
      adults: 2,
      children: 0,
      rooms: 1,
    });
  });

  it.each([
    ["2 adults, no children, 1 room", undefined],
    ["2 adults; 1 room", undefined],
    ["Atlantis, 2 adults, 1 room", "Atlantis"],
    ["Atlantis 2 adults 1 room", "Atlantis"],
  ])("does not keep separators as the hotel: %j", (input, hotel) => {
    expect(parseStayMessage(input).hotel).toBe(hotel);
  });

  it("changes only the check-out on a check-out edit", () => {
    const patch = parseStayMessage("change check-out to 2026-10-16");
    expect(patch.checkOut).toBe("2026-10-16");
    expect(patch.checkIn).toBeUndefined();
  });

  it("reads a hotel rename", () => {
    expect(parseStayMessage("change the hotel to One&Only Reethi Rah").hotel).toBe(
      "One&Only Reethi Rah",
    );
  });
});

describe("mergeStayDraft", () => {
  it("keeps current values the patch does not set", () => {
    const current: StayDraft = { ...EMPTY, hotel: "Atlantis", city: "Dubai", adults: 2 };
    expect(mergeStayDraft(current, { rooms: 1, hotel: "  " })).toEqual({ ...current, rooms: 1 });
  });
});

describe("partyReady", () => {
  const ready: StayDraft = {
    hotel: "Atlantis",
    city: "Dubai",
    checkIn: "2026-10-10",
    checkOut: "2026-10-14",
    adults: 2,
    children: 0,
    rooms: 1,
  };

  it("needs adults, children and rooms", () => {
    expect(partyReady(ready)).toBe(true);
    expect(partyReady({ ...ready, rooms: null })).toBe(false);
    expect(partyReady({ ...ready, adults: 0 })).toBe(false);
  });
});
