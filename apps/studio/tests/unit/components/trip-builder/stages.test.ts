import { describe, expect, it } from "vitest";

import { findOverlappingStay, stayGapNotes, staysOutsideWindow } from "@/components/trip-builder/stages";
import { makeStay } from "@/tests/factories/trips";

const dubai = makeStay({ leg_id: "a", city: "Dubai", check_in: "2026-10-10", check_out: "2026-10-14" });
const maldives = makeStay({ leg_id: "b", city: "Maldives", check_in: "2026-10-16", check_out: "2026-10-20" });

describe("findOverlappingStay", () => {
  it("finds a stay whose nights overlap", () => {
    expect(findOverlappingStay([dubai, maldives], "2026-10-12", "2026-10-17")).toBe(dubai);
  });

  it("treats checkout on the next check-in as no overlap", () => {
    expect(findOverlappingStay([dubai], "2026-10-14", "2026-10-16")).toBeNull();
  });

  it("ignores the stay being edited", () => {
    expect(findOverlappingStay([dubai], "2026-10-11", "2026-10-13", "a")).toBeNull();
  });
});

describe("stayGapNotes", () => {
  it("names travel nights between stays", () => {
    expect(stayGapNotes([dubai, maldives])).toEqual(["2 nights between Dubai and Maldives"]);
  });

  it("is empty when stays touch", () => {
    const next = makeStay({ leg_id: "c", city: "Muscat", check_in: "2026-10-14", check_out: "2026-10-16" });
    expect(stayGapNotes([dubai, next])).toEqual([]);
  });
});

describe("staysOutsideWindow", () => {
  it("lists stays that no longer fit the trip dates", () => {
    expect(staysOutsideWindow([dubai, maldives], "2026-10-10", "2026-10-18")).toEqual([maldives]);
  });
});
