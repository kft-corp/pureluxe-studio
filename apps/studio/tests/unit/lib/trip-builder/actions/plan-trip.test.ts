import type { FamilyMembership } from "@pureluxe/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

const lookups = vi.hoisted(() => ({
  findClientFamily: vi.fn(),
  requireActiveClient: vi.fn(),
}));

vi.mock("@pureluxe/db", () => ({ findClientFamily: lookups.findClientFamily }));
vi.mock("@/lib/clients/require-active-client", () => ({ requireActiveClient: lookups.requireActiveClient }));

import { partyLabel, planParty, planStays } from "@/lib/trip-builder/actions/plan-trip";

const MEHTAS: FamilyMembership = {
  family_id: "fam-1",
  family_name: "Mehta family",
  role: "child",
  is_primary: false,
  members: [
    { client_id: "ravi", display_name: "Ravi Mehta", role: "primary", is_primary: true },
    { client_id: "anika", display_name: "Anika Mehta", role: "spouse", is_primary: false },
    { client_id: "aarav", display_name: "Aarav Mehta", role: "child", is_primary: false },
    { client_id: "kiara", display_name: "Kiara Mehta", role: "child", is_primary: false },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  lookups.requireActiveClient.mockResolvedValue({ id: "aarav", display_name: "Aarav Mehta" });
  lookups.findClientFamily.mockResolvedValue(MEHTAS);
});

describe("planParty", () => {
  it("makes the household's primary the lead when the advisor names the family", async () => {
    const party = await planParty({ clientId: "aarav", withHousehold: true, lead: "household_primary" });

    expect(party.lead).toEqual({ client_id: "ravi", display_name: "Ravi Mehta" });
    expect(party.companions.map((person) => [person.client_id, person.party_role])).toEqual([
      ["anika", "adult"],
      ["aarav", "child"],
      ["kiara", "child"],
    ]);
    expect(partyLabel(party)).toBe("Ravi Mehta with Anika, Aarav and Kiara (2 adults, 2 children)");
  });

  it("keeps the named client as lead, travelling alone, without loading the household", async () => {
    const party = await planParty({ clientId: "aarav", withHousehold: false, lead: "named" });

    expect(party).toEqual({ lead: { client_id: "aarav", display_name: "Aarav Mehta" }, companions: [] });
    expect(lookups.findClientFamily).not.toHaveBeenCalled();
    expect(partyLabel(party)).toBe("Aarav Mehta (1 adult)");
  });
});

describe("planStays", () => {
  const WINDOW = { current: [], start: "2026-12-15", end: "2026-12-20" };

  it("spreads one stay without dates over the whole trip", () => {
    expect(planStays({ ...WINDOW, requested: [{ city: "City: maldives" }] })).toEqual({
      stays: [
        { leg_id: null, city: "Maldives", check_in: "2026-12-15", check_out: "2026-12-20", hotel: null, rooms: null },
      ],
      roomsAssumed: false,
    });
  });

  it("assumes rooms when a hotel comes without them", () => {
    const { stays, roomsAssumed } = planStays({ ...WINDOW, requested: [{ city: "Maldives", hotel: "Resort One" }] });
    expect(stays[0]).toMatchObject({ hotel: "Resort One", rooms: null });
    expect(roomsAssumed).toBe(true);
  });

  it("refuses stays that leave the trip, overlap, or have no dates", () => {
    const plan = (requested: Parameters<typeof planStays>[0]["requested"]) => () => planStays({ ...WINDOW, requested });

    expect(plan([{ city: "Maldives", checkIn: "12-18", checkOut: "12-22" }])).toThrow(
      expect.objectContaining({ code: "trips.leg_outside" }),
    );
    expect(
      plan([
        { city: "Male", checkIn: "12-15", checkOut: "12-18" },
        { city: "Baa Atoll", checkIn: "12-17", checkOut: "12-20" },
      ]),
    ).toThrow(expect.objectContaining({ code: "trips.stay_overlap" }));
    expect(plan([{ city: "Male" }, { city: "Baa Atoll" }])).toThrow(
      expect.objectContaining({ code: "trips.stay_dates_required" }),
    );
    expect(plan([{ city: "completed" }])).toThrow(expect.objectContaining({ code: "trips.not_a_place" }));
  });
});
