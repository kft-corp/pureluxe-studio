import { describe, expect, it } from "vitest";

import { planStays, rangeLabel } from "@/lib/trip-builder/actions/plan-trip";

/**
 * Stage 4 multi-city split: planStays builds the proposed legs; the card summary
 * is "City day–day, City day–day?" (golden test #2 — ask once).
 */
describe("multi-city split planning (Stage 4)", () => {
  it("plans two non-overlapping stays inside the trip window", () => {
    const { stays } = planStays({
      current: [],
      requested: [
        { city: "Malé", checkIn: "2026-12-10", checkOut: "2026-12-12" },
        { city: "Baa Atoll", checkIn: "2026-12-12", checkOut: "2026-12-15" },
      ],
      start: "2026-12-10",
      end: "2026-12-15",
    });
    expect(stays).toHaveLength(2);
    expect(stays[0]).toMatchObject({
      city: "Malé",
      check_in: "2026-12-10",
      check_out: "2026-12-12",
    });
    expect(stays[1]).toMatchObject({
      city: "Baa Atoll",
      check_in: "2026-12-12",
      check_out: "2026-12-15",
    });
    expect(rangeLabel(stays[0]!.check_in, stays[0]!.check_out)).toContain("Dec");
  });

  it("refuses overlapping stays", () => {
    expect(() =>
      planStays({
        current: [],
        requested: [
          { city: "Malé", checkIn: "2026-12-10", checkOut: "2026-12-13" },
          { city: "Baa Atoll", checkIn: "2026-12-12", checkOut: "2026-12-15" },
        ],
        start: "2026-12-10",
        end: "2026-12-15",
      }),
    ).toThrow(/overlap/i);
  });
});
