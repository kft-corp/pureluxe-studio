import { describe, expect, it } from "vitest";

import {
  ASSUMED_CHILD_AGE,
  partyFitsRate,
  splitPartyAcrossRooms,
} from "../../../src/pricing";

describe("splitPartyAcrossRooms (R12)", () => {
  it("puts one adult and one child in each of two rooms", () => {
    const { rooms, child_ages_assumed } = splitPartyAcrossRooms({
      adults: 2,
      children: 2,
      rooms: 2,
      child_ages: [8, 6],
    });

    expect(child_ages_assumed).toBe(false);
    expect(rooms).toEqual([
      { adults: 1, children: 1, child_ages: [8] },
      { adults: 1, children: 1, child_ages: [6] },
    ]);
  });

  it("assumes child ages when missing", () => {
    const { rooms, child_ages_assumed } = splitPartyAcrossRooms({
      adults: 2,
      children: 1,
      rooms: 1,
    });

    expect(child_ages_assumed).toBe(true);
    expect(rooms[0]?.child_ages).toEqual([ASSUMED_CHILD_AGE]);
  });
});

describe("partyFitsRate (R12)", () => {
  const beachVilla = {
    base_adults: 2,
    base_children: 0,
    max_adults: 2,
    max_children: 0,
  };

  it("hides a villa for 2 when three adults share one room", () => {
    const { rooms } = splitPartyAcrossRooms({ adults: 3, children: 0, rooms: 1 });
    expect(partyFitsRate(beachVilla, rooms)).toBe(false);
  });

  it("allows two adults in one Beach Villa", () => {
    const { rooms } = splitPartyAcrossRooms({ adults: 2, children: 0, rooms: 1 });
    expect(partyFitsRate(beachVilla, rooms)).toBe(true);
  });
});
