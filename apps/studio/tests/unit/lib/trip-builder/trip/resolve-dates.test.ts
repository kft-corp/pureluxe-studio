import { describe, expect, it } from "vitest";

import { defaultRoomCount, resolveTripDates } from "@/lib/trip-builder/trip/resolve-dates";

describe("resolveTripDates", () => {
  it("keeps full dates as given", () => {
    expect(resolveTripDates({ start: "2027-03-01", end: "2027-03-05", today: "2026-10-20" })).toEqual({
      start: "2027-03-01",
      end: "2027-03-05",
      yearAssumed: false,
    });
  });

  it("uses this year when the dates are still ahead", () => {
    expect(resolveTripDates({ start: "12-10", end: "12-15", today: "2026-10-19" })).toEqual({
      start: "2026-12-10",
      end: "2026-12-15",
      yearAssumed: true,
    });
  });

  it("uses next year once the dates have passed", () => {
    expect(resolveTripDates({ start: "12-10", end: "12-15", today: "2026-12-20" })).toMatchObject({
      start: "2027-12-10",
      end: "2027-12-15",
    });
  });

  it("crosses the year when the end comes before the start", () => {
    expect(resolveTripDates({ start: "12-28", end: "01-03", today: "2026-10-20" })).toMatchObject({
      start: "2026-12-28",
      end: "2027-01-03",
    });
  });

  it("starts today when the trip starts today", () => {
    expect(resolveTripDates({ start: "10-20", end: "10-25", today: "2026-10-20" }).start).toBe("2026-10-20");
  });

  it.each([
    [{ start: "13-01", end: "13-05" }, "not a real date"],
    [{ start: "2026-12-15", end: "2026-12-10" }, "ends"],
    [{ start: "next week", end: "12-15" }, "not a date"],
  ])("rejects %j", (dates, message) => {
    expect(() => resolveTripDates({ ...dates, today: "2026-10-20" })).toThrow(message);
  });
});

describe("defaultRoomCount", () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 2],
    [0, 1],
  ])("%i adults → %i rooms", (adults, rooms) => {
    expect(defaultRoomCount(adults)).toBe(rooms);
  });
});
