import type { DeskAgentHandlers } from "@pureluxe/ai";
import { searchActivePropertiesByName } from "@pureluxe/db";
import {
  AppError,
  hasPermission,
  journeyToday,
  listBookingsQuerySchema,
  listJourneysQuerySchema,
} from "@pureluxe/shared";

import { getBookingDetail, listBookingDirectory } from "@/lib/bookings";
import { searchClients } from "@/lib/clients";
import { answerAtlasStay, type AtlasHotelChoice } from "@/lib/trip-builder/stays/atlas-stay";
import { loadHotelStayFacts } from "@/lib/trip-builder/stays/hotel-contract-facts";
import { listJourneyDirectory } from "@/lib/trips";

import { toClientSearchHit } from "./to-client-search-hit";
import {
  toBookingBrief,
  toBookingHistoryRow,
  toTripHistoryRow,
} from "./to-history-rows";

export type DeskActor = {
  memberId: string;
  permissions: readonly string[];
};

const DEFAULT_LIMIT = 10;
const CLIENT_MATCHES = 8;
const HOTEL_MATCHES = 3;

const CONTRACTED: Record<AtlasHotelChoice["contractStatus"], boolean | null> = {
  contracted: true,
  not_yet_contracted: false,
  unknown: null,
};

function requireAccess(actor: DeskActor, permission: string, area: string) {
  if (hasPermission(actor.permissions, permission)) return;
  throw new AppError({
    userMessage: `This advisor does not have access to ${area}.`,
    code: "auth.forbidden",
    status: 403,
  });
}

/**
 * Lookups shared by the home chat and the trip chat. Only loading a client differs
 * (the trip chat falls back to the trip's lead), so each chat adds getClient itself.
 * A client's history covers the whole team; otherwise the advisor's own work.
 */
export function createDeskTools(actor: DeskActor): Omit<DeskAgentHandlers, "getClient"> {
  return {
    async searchClients({ query, limit }) {
      const result = await searchClients({ q: query, limit: limit ?? CLIENT_MATCHES });
      return { clients: result.clients.map(toClientSearchHit) };
    },

    async getPlaceNotes({ query, cityHint }) {
      const atlas = await answerAtlasStay({ question: query, cityHint: cityHint ?? null });
      return {
        matched: atlas.matched,
        notes: atlas.matched ? atlas.answer : null,
        hotels: atlas.hotels.map((hotel) => ({
          name: hotel.name,
          city: hotel.city,
          contracted: CONTRACTED[hotel.contractStatus],
        })),
      };
    },

    async searchTrips({ clientId, query, stage, mine, limit }) {
      requireAccess(actor, "trips.read", "Trips");
      const result = await listJourneyDirectory({
        ...listJourneysQuerySchema.parse({
          q: query ?? "",
          scope: (mine ?? !clientId) ? "mine" : "all",
          stage: stage ?? "any",
          limit: limit ?? DEFAULT_LIMIT,
        }),
        actorMemberId: actor.memberId,
        clientId: clientId ?? null,
      });
      return { trips: result.journeys.map(toTripHistoryRow), total: result.total };
    },

    async searchBookings({ clientId, query, work, status, mine, limit }) {
      requireAccess(actor, "bookings.read", "Bookings");
      const result = await listBookingDirectory({
        ...listBookingsQuerySchema.parse({
          q: query ?? "",
          scope: (mine ?? !clientId) ? "mine" : "all",
          work: work ?? "any",
          status: status ?? "any",
          limit: limit ?? DEFAULT_LIMIT,
        }),
        actorMemberId: actor.memberId,
        clientId: clientId ?? null,
      });
      return { bookings: result.bookings.map(toBookingHistoryRow), total: result.total };
    },

    async getBooking({ bookingId }) {
      requireAccess(actor, "bookings.read", "Bookings");
      return toBookingBrief(await getBookingDetail(bookingId), journeyToday());
    },

    async getHotel({ name, checkIn, checkOut }) {
      const properties = await searchActivePropertiesByName(name, HOTEL_MATCHES);
      const hotels = await Promise.all(
        properties.map(async (property) => {
          const facts = await loadHotelStayFacts({
            propertyId: property.id,
            checkIn: checkIn ?? null,
            checkOut: checkOut ?? null,
            contractId: null,
          });
          return {
            name: property.name,
            city: property.city ?? null,
            country: property.country ?? null,
            contracted: (facts?.contractCount ?? 0) > 0,
            facts: facts?.chatBrief ?? null,
          };
        }),
      );
      return { hotels };
    },
  };
}
