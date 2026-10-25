import { describe, expect, it } from "vitest";

import { computeRoomStayCost } from "../../../src/pricing";
import {
  beachVillaHigh,
  beachVillaPeak,
} from "../../fixtures/kanuhura-contract";

describe("computeRoomStayCost (R1)", () => {
  it("prices a single-season stay as nights × nightly rate", () => {
    const priced = computeRoomStayCost({
      rates: [beachVillaHigh],
      room_category: "Beach Villa",
      check_in: "2027-01-10",
      check_out: "2027-01-15",
      adults: 2,
    });

    expect(priced).not.toBeNull();
    expect(priced!.cost).toBe(1470 * 5);
    expect(priced!.seasons).toEqual(["high"]);
  });

  it("sums night by night across peak and high seasons", () => {
    // 2027-01-05 → 2027-01-10: peak nights 5–6 Jan, high nights 7–9 Jan
    const priced = computeRoomStayCost({
      rates: [beachVillaPeak, beachVillaHigh],
      room_category: "Beach Villa",
      check_in: "2027-01-05",
      check_out: "2027-01-10",
      adults: 2,
    });

    expect(priced).not.toBeNull();
    // peak: 5, 6 Jan (2) × 2450; high: 7, 8, 9 Jan (3) × 1470
    expect(priced!.cost).toBe(2450 * 2 + 1470 * 3);
    expect(priced!.seasons.sort()).toEqual(["high", "peak"]);
  });

  it("returns null when a night has no covering rate", () => {
    const priced = computeRoomStayCost({
      rates: [beachVillaHigh],
      room_category: "Beach Villa",
      check_in: "2026-12-28",
      check_out: "2027-01-02",
      adults: 2,
    });

    expect(priced).toBeNull();
  });
});
