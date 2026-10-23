import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TripDetail } from "@/lib/trip-builder";
import { makeStay, makeTripDetail } from "@/tests/factories/trips";

const services = vi.hoisted(() => ({
  updateTrip: vi.fn(),
  addTripLeg: vi.fn(),
  reviseTripLeg: vi.fn(),
  removeTripLeg: vi.fn(),
  setTripStay: vi.fn(),
  getTripDetail: vi.fn(),
  dbUpdateTrip: vi.fn(),
  addTripTravellers: vi.fn(),
}));

vi.mock("@pureluxe/db", () => ({
  deleteLineItemsForLeg: vi.fn(),
  updateTrip: services.dbUpdateTrip,
}));
vi.mock("@/lib/trip-builder/trip/update-trip", () => ({ updateTrip: services.updateTrip }));
vi.mock("@/lib/trip-builder/stays/add-trip-leg", () => ({ addTripLeg: services.addTripLeg }));
vi.mock("@/lib/trip-builder/stays/revise-trip-leg", () => ({ reviseTripLeg: services.reviseTripLeg }));
vi.mock("@/lib/trip-builder/stays/remove-trip-leg", () => ({ removeTripLeg: services.removeTripLeg }));
vi.mock("@/lib/trip-builder/stays/set-trip-stay", () => ({ setTripStay: services.setTripStay }));
vi.mock("@/lib/trip-builder/stays/stay-side-effects", () => ({ markQuoteStale: vi.fn() }));
vi.mock("@/lib/trip-builder/trip/get-trip-detail", () => ({ getTripDetail: services.getTripDetail }));
vi.mock("@/lib/trip-builder/party/trip-party", () => ({
  addTripTravellers: services.addTripTravellers,
  changeTripLead: vi.fn(),
  confirmTripTravellers: vi.fn(),
  removeTripTraveller: vi.fn(),
  partyCounts: () => ({ adults: 2, children: 0 }),
}));

import { applyTripShape } from "@/lib/trip-builder/actions/apply-trip-shape";
import type { TripShape } from "@/lib/trip-builder/actions/trip-shape";

const ACTOR = { memberId: "member-1" };
const CLIENT = { id: "c1", display_name: "Aarav Mehta" };
const LEAD = { client_id: "c1", display_name: "Aarav Mehta", role: "primary" as const, party_role: "adult" as const, family_role: null };
const CONFIRMED = "2026-10-01T00:00:00.000Z";

/** Lead set, no dates or stays. */
const NEW_TRIP = makeTripDetail({
  client: CLIENT,
  travellers: [LEAD],
  trip: { primary_client_id: "c1", travellers_confirmed_at: CONFIRMED },
});

const MALDIVES = makeStay({ leg_id: "leg-1", city: "Maldives", check_in: "2026-12-10", check_out: "2026-12-15" });

function withTrip(detail: TripDetail, trip: Partial<TripDetail["trip"]>, stays = detail.stays): TripDetail {
  return { ...detail, trip: { ...detail.trip, ...trip }, stays, stay: stays[0] ?? null };
}

function target(partial: Partial<TripShape>): TripShape {
  return {
    lead_client_id: "c1",
    companions: [],
    travellers_confirmed: true,
    starts_on: "2026-12-10",
    ends_on: "2026-12-15",
    stays: [],
    legs_confirmed: true,
    assumptions: {},
    ...partial,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("applyTripShape", () => {
  it("sets up a new trip in order, without reloading it", async () => {
    const dated = withTrip(NEW_TRIP, { starts_on: "2026-12-10", ends_on: "2026-12-15" });
    const listed = withTrip(dated, {}, [MALDIVES]);
    const confirmed = withTrip(listed, { legs_confirmed_at: CONFIRMED });
    const withHotel = withTrip(confirmed, {}, [{ ...MALDIVES, property_name: "Soneva Fushi", rooms: 1 }]);
    services.updateTrip.mockResolvedValueOnce(dated).mockResolvedValueOnce(confirmed);
    services.addTripLeg.mockResolvedValue({ detail: listed, leg_id: "leg-1" });
    services.setTripStay.mockResolvedValue({ detail: withHotel });
    services.dbUpdateTrip.mockImplementation(async (_id, patch) => ({ ...withHotel.trip, ...patch }));

    const after = await applyTripShape(
      "trip-1",
      target({
        stays: [{ leg_id: null, city: "Maldives", check_in: "2026-12-10", check_out: "2026-12-15", hotel: "Soneva Fushi", rooms: null }],
        assumptions: { year: true, rooms: true },
      }),
      ACTOR,
      NEW_TRIP,
    );

    expect(services.getTripDetail).not.toHaveBeenCalled();
    expect(services.updateTrip.mock.calls.map((call) => call[1])).toEqual([
      { starts_on: "2026-12-10", ends_on: "2026-12-15" },
      { confirm_legs: true },
    ]);
    expect(services.addTripLeg).toHaveBeenCalledOnce();
    expect(services.setTripStay).toHaveBeenCalledWith(
      "trip-1",
      expect.objectContaining({ leg_id: "leg-1", property_name: "Soneva Fushi", rooms: 1 }),
      ACTOR,
    );
    expect(services.updateTrip.mock.invocationCallOrder[1]).toBeLessThan(
      services.setTripStay.mock.invocationCallOrder[0]!,
    );
    expect(services.dbUpdateTrip).toHaveBeenCalledWith("trip-1", { assumptions: { year: true, rooms: true } });
    expect(after.trip.assumptions).toEqual({ year: true, rooms: true });
  });

  it("moves a single stay with the dates: widens, moves, then narrows", async () => {
    const current = withTrip(
      NEW_TRIP,
      { starts_on: "2026-12-10", ends_on: "2026-12-15", legs_confirmed_at: CONFIRMED },
      [MALDIVES],
    );
    const moved = { ...MALDIVES, check_in: "2026-12-11", check_out: "2026-12-16" };
    const wide = withTrip(current, { ends_on: "2026-12-16" });
    const revised = withTrip(wide, {}, [moved]);
    const narrowed = withTrip(revised, { starts_on: "2026-12-11" });
    services.updateTrip.mockResolvedValueOnce(wide).mockResolvedValueOnce(narrowed);
    services.reviseTripLeg.mockResolvedValue(revised);

    await applyTripShape(
      "trip-1",
      target({
        starts_on: "2026-12-11",
        ends_on: "2026-12-16",
        stays: [{ leg_id: "leg-1", city: "Maldives", check_in: "2026-12-11", check_out: "2026-12-16", hotel: null, rooms: null }],
      }),
      ACTOR,
      current,
    );

    expect(services.updateTrip.mock.calls.map((call) => call[1])).toEqual([
      { starts_on: "2026-12-10", ends_on: "2026-12-16" },
      { starts_on: "2026-12-11", ends_on: "2026-12-16" },
    ]);
    expect(services.reviseTripLeg).toHaveBeenCalledOnce();
    expect(services.addTripLeg).not.toHaveBeenCalled();
    expect(services.dbUpdateTrip).not.toHaveBeenCalled();
  });

  it("adds a whole household in one call", async () => {
    const withFamily = makeTripDetail({
      ...NEW_TRIP,
      travellers: [
        LEAD,
        { ...LEAD, client_id: "c2", display_name: "Anika Mehta", role: "companion" as const },
        { ...LEAD, client_id: "c3", display_name: "Kiara Mehta", role: "companion" as const, party_role: "child" as const },
      ],
    });
    services.addTripTravellers.mockResolvedValue(withFamily);

    await applyTripShape(
      "trip-1",
      target({
        companions: [
          { client_id: "c2", party_role: "adult" },
          { client_id: "c3", party_role: "child" },
        ],
        starts_on: null,
        ends_on: null,
        legs_confirmed: false,
      }),
      ACTOR,
      NEW_TRIP,
    );

    expect(services.addTripTravellers).toHaveBeenCalledOnce();
    expect(services.addTripTravellers).toHaveBeenCalledWith(
      "trip-1",
      [
        { client_id: "c2", party_role: "adult" },
        { client_id: "c3", party_role: "child" },
      ],
      ACTOR,
    );
  });

  it("does nothing more than the change needs", async () => {
    const current = withTrip(
      NEW_TRIP,
      { starts_on: "2026-12-10", ends_on: "2026-12-15", legs_confirmed_at: CONFIRMED },
      [MALDIVES],
    );

    const after = await applyTripShape(
      "trip-1",
      target({
        stays: [{ leg_id: "leg-1", city: "Maldives", check_in: "2026-12-10", check_out: "2026-12-15", hotel: null, rooms: null }],
      }),
      ACTOR,
      current,
    );

    expect(after).toBe(current);
    for (const service of Object.values(services)) expect(service).not.toHaveBeenCalled();
  });
});
