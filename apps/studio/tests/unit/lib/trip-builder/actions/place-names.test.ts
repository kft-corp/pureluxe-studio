import { describe, expect, it } from "vitest";

import { cleanPlaceName } from "@/lib/trip-builder/actions/place-names";

describe("cleanPlaceName", () => {
  it.each([
    ["City: Maldives", "Maldives"],
    ["Destination - Bali", "Bali"],
    ["City maldives", "Maldives"],
    ["  maldives  ", "Maldives"],
    ["City of London", "City of London"],
    ["Mexico City", "Mexico City"],
  ])("reads %j as %j", (typed, name) => {
    expect(cleanPlaceName(typed, "city")).toBe(name);
  });

  it("drops a hotel label but keeps the name as written", () => {
    expect(cleanPlaceName("Hotel: Six Senses Kanuhura", "hotel")).toBe("Six Senses Kanuhura");
    expect(cleanPlaceName("one&only reethi rah", "hotel")).toBe("One&Only Reethi Rah");
  });

  it.each(["completed", "done", "Plan these stays", "yes.", "City:"])("refuses %j as a place", (typed) => {
    expect(() => cleanPlaceName(typed, "city")).toThrow(expect.objectContaining({ code: "trips.not_a_place" }));
  });
});
