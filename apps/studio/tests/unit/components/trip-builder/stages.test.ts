import { describe, expect, it } from "vitest";

import { stayGapNotes } from "@/components/trip-builder/stages";
import { makeStay } from "@/tests/factories/trips";

const dubai = makeStay({ leg_id: "a", city: "Dubai", check_in: "2026-10-10", check_out: "2026-10-14" });
const maldives = makeStay({ leg_id: "b", city: "Maldives", check_in: "2026-10-16", check_out: "2026-10-20" });

describe("stayGapNotes", () => {
  it("names travel nights between stays", () => {
    expect(stayGapNotes([dubai, maldives])).toEqual(["2 nights between Dubai and Maldives"]);
  });

  it("is empty when stays touch", () => {
    const next = makeStay({ leg_id: "c", city: "Muscat", check_in: "2026-10-14", check_out: "2026-10-16" });
    expect(stayGapNotes([dubai, next])).toEqual([]);
  });
});
