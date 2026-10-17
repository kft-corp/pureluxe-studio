import { describe, expect, it } from "vitest";

import {
  looksLikeHotelPlan,
  parseAddStay,
  parseCityOnly,
  parseListedStayEdit,
  parseRemoveStay,
  parseTripDates,
  parseTripShift,
  wantsAddStay,
  wantsChangeTripDates,
} from "@/lib/trip-builder/intents";

describe("parseTripDates", () => {
  it.each([
    ["Start: 2026-10-10\nEnd: 2026-10-20", { checkIn: "2026-10-10", checkOut: "2026-10-20" }],
    ["2026-10-10 to 2026-10-20", { checkIn: "2026-10-10", checkOut: "2026-10-20" }],
    ["add Dubai 2026-10-10 2026-10-14", null],
    ["Start: 2026-10-20\nEnd: 2026-10-10", null],
    ["next week sometime", null],
  ])("%j", (input, expected) => {
    expect(parseTripDates(input)).toEqual(expected);
  });
});

describe("parseAddStay", () => {
  it("reads a city and two dates", () => {
    expect(parseAddStay("add Dubai 2026-10-10 2026-10-14")).toEqual({
      city: "Dubai",
      checkIn: "2026-10-10",
      checkOut: "2026-10-14",
    });
  });

  it("reads a labelled city", () => {
    expect(parseAddStay("City: Maldives\nCheck-in: 2026-10-10\nCheck-out: 2026-10-15")).toEqual({
      city: "Maldives",
      checkIn: "2026-10-10",
      checkOut: "2026-10-15",
    });
  });

  it("needs both dates", () => {
    expect(parseAddStay("add Dubai 2026-10-10")).toBeNull();
  });
});

describe("parseTripShift", () => {
  it.each([
    ["shift the trip by 2 days", 2],
    ["push all dates back a day", 1],
    ["bring the trip forward a week", -7],
    ["move everything 3 days earlier", -3],
    ["move the trip to a week in Bali", null],
    ["shift the hotel by 2 days", null],
  ])("%j", (input, expected) => {
    expect(parseTripShift(input)).toBe(expected);
  });
});

describe("parseRemoveStay", () => {
  it.each([
    ["remove Dubai", "Dubai"],
    ["remove this stay", "open"],
    ["what is the weather", null],
  ])("%j", (input, expected) => {
    expect(parseRemoveStay(input)).toBe(expected);
  });
});

describe("parseCityOnly", () => {
  it.each([
    ["Maldives", "Maldives"],
    ["City: Dubai", "Dubai"],
    ["yes", null],
    ["Dubai 2026-10-10", null],
  ])("%j", (input, expected) => {
    expect(parseCityOnly(input)).toBe(expected);
  });
});

describe("parseListedStayEdit", () => {
  const stays = [{ city: "Dubai" }, { city: "Maldives" }];

  it("matches a stay already on the trip", () => {
    expect(parseListedStayEdit("Dubai 2026-10-11 2026-10-15", stays)).toEqual({
      city: "Dubai",
      checkIn: "2026-10-11",
      checkOut: "2026-10-15",
    });
  });

  it("leaves an add as an add", () => {
    expect(parseListedStayEdit("add Dubai 2026-10-11 2026-10-15", stays)).toBeNull();
  });

  it("ignores a city that is not on the trip", () => {
    expect(parseListedStayEdit("Muscat 2026-10-11 2026-10-15", stays)).toBeNull();
  });
});

describe("stay word checks", () => {
  it("wantsAddStay", () => {
    expect(wantsAddStay("add another stay")).toBe(true);
    expect(wantsAddStay("add Dubai 2026-10-10 2026-10-14")).toBe(true);
    expect(wantsAddStay("add Ravi")).toBe(false);
  });

  it("wantsChangeTripDates", () => {
    expect(wantsChangeTripDates("change the trip dates")).toBe(true);
    expect(wantsChangeTripDates("what are the dates")).toBe(false);
  });

  it("looksLikeHotelPlan", () => {
    expect(looksLikeHotelPlan("Hotel: Atlantis")).toBe(true);
    expect(looksLikeHotelPlan("Adults: 2")).toBe(true);
    expect(looksLikeHotelPlan("which hotel is best")).toBe(false);
  });
});
