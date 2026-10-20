import { vi } from "vitest";

import type { TripAgentHandlers } from "../../src/agent/types";
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
  } satisfies TripAgentHandlers;
}
