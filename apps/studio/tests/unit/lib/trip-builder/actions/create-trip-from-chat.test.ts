import type { TripCreateRequest } from "@pureluxe/ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeTripDetail } from "@/tests/factories/trips";

const services = vi.hoisted(() => ({
  findTripCreatedWithKey: vi.fn(),
  listUpcomingClientTrips: vi.fn(),
  recordTripChange: vi.fn(),
  createTrip: vi.fn(),
  applyTripShape: vi.fn(),
  planParty: vi.fn(),
}));

vi.mock("@pureluxe/db", () => ({
  findTripCreatedWithKey: services.findTripCreatedWithKey,
  listUpcomingClientTrips: services.listUpcomingClientTrips,
  recordTripChange: services.recordTripChange,
}));
vi.mock("@pureluxe/shared", async (original) => ({
  ...(await original<typeof import("@pureluxe/shared")>()),
  journeyToday: () => "2026-10-21",
}));
vi.mock("@/lib/trip-builder/trip/create-trip", () => ({ createTrip: services.createTrip }));
vi.mock("@/lib/trip-builder/actions/apply-trip-shape", () => ({ applyTripShape: services.applyTripShape }));
vi.mock("@/lib/trip-builder/actions/plan-trip", async (original) => ({
  ...(await original<typeof import("@/lib/trip-builder/actions/plan-trip")>()),
  planParty: services.planParty,
}));

import { createTripFromChat } from "@/lib/trip-builder/actions/create-trip-from-chat";

const CONTEXT = { actor: { memberId: "member-1" }, idempotencyKey: "trip_create:send-1" };
const RAVI_FAMILY = {
  lead: { client_id: "ravi", display_name: "Ravi Mehta" },
  companions: [
    { client_id: "anika", display_name: "Anika Mehta", party_role: "adult" },
    { client_id: "aarav", display_name: "Aarav Mehta", party_role: "child" },
    { client_id: "kiara", display_name: "Kiara Mehta", party_role: "child" },
  ],
};
const REQUEST: TripCreateRequest = {
  clientId: "aarav",
  lead: "household_primary",
  withHousehold: true,
  start: "12-15",
  end: "12-20",
  stays: [{ city: "Maldives" }],
  createAnyway: false,
};
const NEW_TRIP = makeTripDetail({ trip: { id: "trip-new" } });

beforeEach(() => {
  vi.clearAllMocks();
  services.findTripCreatedWithKey.mockResolvedValue(null);
  services.listUpcomingClientTrips.mockResolvedValue([]);
  services.planParty.mockResolvedValue(RAVI_FAMILY);
  services.createTrip.mockResolvedValue(NEW_TRIP);
});

describe("createTripFromChat", () => {
  it("creates the trip with the household, dates and stay in one go", async () => {
    const result = await createTripFromChat(CONTEXT, REQUEST);

    expect(result).toEqual({
      ok: true,
      status: "created",
      trip_id: "trip-new",
      summary:
        "Trip created for Ravi Mehta with Anika, Aarav and Kiara (2 adults, 2 children) · Maldives 15 Dec – 20 Dec 2026 (year assumed)",
    });
    expect(services.createTrip).toHaveBeenCalledWith({ primary_client_id: "ravi" }, CONTEXT.actor);
    expect(services.applyTripShape).toHaveBeenCalledWith(
      "trip-new",
      expect.objectContaining({
        companions: [
          { client_id: "anika", party_role: "adult" },
          { client_id: "aarav", party_role: "child" },
          { client_id: "kiara", party_role: "child" },
        ],
        travellers_confirmed: true,
        starts_on: "2026-12-15",
        ends_on: "2026-12-20",
        stays: [expect.objectContaining({ city: "Maldives", check_in: "2026-12-15", check_out: "2026-12-20" })],
        assumptions: { year: true },
      }),
      CONTEXT.actor,
      NEW_TRIP,
    );
    expect(services.recordTripChange).toHaveBeenCalledWith(
      expect.objectContaining({ tripId: "trip-new", tool: "trip_create", idempotencyKey: CONTEXT.idempotencyKey }),
    );
  });

  it("returns the trip a retried message already created", async () => {
    services.findTripCreatedWithKey.mockResolvedValue("trip-earlier");

    const result = await createTripFromChat(CONTEXT, REQUEST);

    expect(result).toMatchObject({ status: "created", trip_id: "trip-earlier", unchanged: true });
    expect(services.createTrip).not.toHaveBeenCalled();
  });

  it("lists every upcoming trip of the party instead of creating one: same dates, then same place", async () => {
    const trip = (id: string, starts_on: string, ends_on: string, destinations: string[], owner = "member-1") => ({
      id,
      title: `Trip ${id}`,
      status: "building",
      starts_on,
      ends_on,
      destinations,
      relationship_owner_id: owner,
      owner_name: owner === "member-1" ? "Vijay" : "Keshav",
    });
    services.listUpcomingClientTrips.mockResolvedValue([
      trip("dubai", "2026-11-05", "2026-11-10", ["Dubai"]),
      trip("maldives-jan", "2027-01-02", "2027-01-06", ["Maldives"]),
      trip("booked", "2026-12-14", "2026-12-18", ["Bali"], "member-2"),
    ]);

    const result = await createTripFromChat(CONTEXT, REQUEST);

    expect(services.createTrip).not.toHaveBeenCalled();
    expect(services.listUpcomingClientTrips).toHaveBeenCalledWith({
      clientIds: ["ravi", "anika", "aarav", "kiara"],
      today: "2026-10-21",
    });
    expect(result.status).toBe("existing");
    const upcoming = result.status === "existing" ? result.upcoming_trips : [];
    expect(upcoming.map((row) => [row.trip_id, row.matches, row.owner_name])).toEqual([
      ["booked", "dates", "Keshav"],
      ["maldives-jan", "destination", null],
      ["dubai", null, null],
    ]);
  });

  it("creates it anyway once the advisor asked for a new trip", async () => {
    const result = await createTripFromChat(CONTEXT, { ...REQUEST, createAnyway: true });

    expect(result).toMatchObject({ status: "created", trip_id: "trip-new" });
    expect(services.listUpcomingClientTrips).not.toHaveBeenCalled();
  });

  it("creates a draft with no client when none was named", async () => {
    const result = await createTripFromChat(CONTEXT, { ...REQUEST, clientId: undefined, start: undefined, end: undefined, stays: [] });

    expect(result).toMatchObject({ status: "created", summary: "Trip created for no client yet · no dates yet" });
    expect(services.planParty).not.toHaveBeenCalled();
    expect(services.createTrip).toHaveBeenCalledWith({ primary_client_id: null }, CONTEXT.actor);
  });

  it("refuses a command word before any trip exists", async () => {
    await expect(createTripFromChat(CONTEXT, { ...REQUEST, stays: [{ city: "done" }] })).rejects.toMatchObject({
      code: "trips.not_a_place",
    });
    expect(services.createTrip).not.toHaveBeenCalled();
  });
});
