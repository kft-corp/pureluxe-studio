import { vi } from "vitest";

import type { HomeAgentHandlers, TripAgentHandlers, TripChange, TripCreateResult } from "../../src/agent/types";
import type { TripFacts } from "../../src/types";

export const CLIENT_ID = "6f1c2a1e-4b7d-4c1a-9a51-3c6e2d1b9f10";
export const BOOKING_ID = "0b6e9d4c-2f1a-4e5b-8c7d-1a2b3c4d5e6f";

export function makeTripFacts(partial: Partial<TripFacts> = {}): TripFacts {
  return {
    trip_id: "trip-1",
    title: "Mehta · Maldives",
    status: "building",
    pricing_locked: false,
    client: { id: CLIENT_ID, display_name: "Aarav Mehta" },
    starts_on: "2026-12-10",
    ends_on: "2026-12-15",
    stay: null,
    stays: [],
    rates: { selected: null, candidates: [] },
    quote: {
      title: null,
      intro: null,
      notes: null,
      highlights: [],
      sell_total: null,
      sell_currency: null,
      document_status: null,
      has_file: false,
    },
    ...partial,
  };
}

/** A trip whose only stay has the client's room, so moving or removing it asks first. */
export function makeBookedTripFacts(): TripFacts {
  return makeTripFacts({
    stays: [
      { city: "Maldives", check_in: "2026-12-10", check_out: "2026-12-15", property_name: "Resort One", rate_selected: true },
    ],
  });
}

function changed(summary: string, undo = true) {
  return vi.fn(async (): Promise<TripChange> => ({ ok: true, summary, undo }));
}

/** Every handler mocked; each test sets what it reads. */
export function makeHandlers(trip: TripFacts = makeTripFacts()) {
  return {
    getTrip: vi.fn(async () => trip),
    searchClients: vi.fn(async () => ({ clients: [] })),
    getClient: vi.fn(),
    searchTrips: vi.fn(async () => ({ trips: [], total: 0 })),
    searchBookings: vi.fn(async () => ({ bookings: [], total: 0 })),
    getBooking: vi.fn(),
    getHotel: vi.fn(async () => ({ hotels: [] })),
    getPlaceNotes: vi.fn(async () => ({ matched: false, notes: null, hotels: [] })),
    getRateSnapshot: vi.fn(async () => ({ status: "none" as const })),
    setClient: changed("Client set to Aarav Mehta"),
    setTravellers: changed("Added Anika Mehta"),
    setDates: changed("Dates set to 10 Dec – 15 Dec 2026"),
    setStays: changed("Stays: Maldives"),
    removeStay: changed("Removed Maldives"),
    shiftDates: changed("Trip moved 2 days later"),
    undo: changed("Undone: Dates set to 10 Dec – 15 Dec 2026", false),
  } satisfies TripAgentHandlers;
}

export const NEW_TRIP_ID = "9d3f6a2b-1c4e-4f8a-b7d6-5e2a1c0b9f83";

/** Home chat handlers: creating a trip succeeds with NEW_TRIP_ID. */
export function makeHomeHandlers() {
  const desk = makeHandlers();
  return {
    searchClients: desk.searchClients,
    getClient: desk.getClient,
    searchTrips: desk.searchTrips,
    searchBookings: desk.searchBookings,
    getBooking: desk.getBooking,
    getHotel: desk.getHotel,
    getPlaceNotes: desk.getPlaceNotes,
    createTrip: vi.fn(
      async (): Promise<TripCreateResult> => ({
        ok: true,
        status: "created",
        trip_id: NEW_TRIP_ID,
        summary: "Trip created for Aarav Mehta",
      }),
    ),
    openTrip: vi.fn(async ({ tripId }: { tripId: string }) => ({ ok: true as const, trip_id: tripId, title: null })),
  } satisfies HomeAgentHandlers;
}
