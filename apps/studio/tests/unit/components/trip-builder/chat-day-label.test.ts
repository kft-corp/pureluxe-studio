import { describe, expect, it } from "vitest";

import { chatDayKey, chatDayLabel } from "@/components/trip-builder/trip-builder-helpers";

/** Local times, so the test holds in any time zone. */
const at = (year: number, month: number, day: number, hour = 10) => new Date(year, month - 1, day, hour).toISOString();
const NOW = new Date(2026, 9, 23, 22, 0);

describe("chatDayLabel", () => {
  it("says Today and Yesterday for the last two days", () => {
    expect(chatDayLabel(at(2026, 10, 23, 8), NOW)).toBe("Today");
    expect(chatDayLabel(at(2026, 10, 22, 23), NOW)).toBe("Yesterday");
  });

  it("names older days, with the year only when it isn't this year", () => {
    expect(chatDayLabel(at(2026, 10, 20), NOW)).toBe("Tue 20 Oct");
    expect(chatDayLabel(at(2025, 12, 31), NOW)).toBe("Wed 31 Dec 2025");
  });
});

describe("chatDayKey", () => {
  it("groups times by local day and ignores bad input", () => {
    expect(chatDayKey(at(2026, 10, 23, 1))).toBe(chatDayKey(at(2026, 10, 23, 23)));
    expect(chatDayKey("not a date")).toBeNull();
  });
});
