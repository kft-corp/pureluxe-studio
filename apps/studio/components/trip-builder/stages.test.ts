import { describe, expect, it } from "vitest";

import type { TripStaySnapshot } from "@/lib/trip-builder";

import { findOverlappingStay, stayGapNotes, staysOutsideWindow } from "./stages";

function stay(partial: Partial<TripStaySnapshot> & { leg_id: string; city: string }): TripStaySnapshot {
  return {
    check_in: null,
    check_out: null,
    property_id: null,
    property_name: null,
    destination_profile_id: null,
    adults: null,
    children: null,
    rooms: null,
    ...partial,
  };
}

const dubai = stay({ leg_id: "a", city: "Dubai", check_in: "2026-10-10", check_out: "2026-10-14" });
const maldives = stay({ leg_id: "b", city: "Maldives", check_in: "2026-10-16", check_out: "2026-10-20" });

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
    const next = stay({ leg_id: "c", city: "Muscat", check_in: "2026-10-14", check_out: "2026-10-16" });
    expect(stayGapNotes([dubai, next])).toEqual([]);
  });
});

describe("staysOutsideWindow", () => {
  it("lists stays that no longer fit the trip dates", () => {
    expect(staysOutsideWindow([dubai, maldives], "2026-10-10", "2026-10-18")).toEqual([maldives]);
  });
});
