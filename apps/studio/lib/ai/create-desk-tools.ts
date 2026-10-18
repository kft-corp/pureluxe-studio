import type { HistoryToolHandlers, HotelToolHandlers } from "@pureluxe/ai";
import { searchActivePropertiesByName } from "@pureluxe/db";
import {
  AppError,
  hasPermission,
  journeyToday,
  listBookingsQuerySchema,
  listJourneysQuerySchema,
} from "@pureluxe/shared";

import { getBookingDetail, listBookingDirectory } from "@/lib/bookings";
import { loadHotelStayFacts } from "@/lib/trip-builder/stays/hotel-contract-facts";
import { listJourneyDirectory } from "@/lib/trips";

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
const HOTEL_MATCHES = 3;

function requireAccess(actor: DeskActor, permission: string, area: string) {
  if (hasPermission(actor.permissions, permission)) return;
  throw new AppError({
    userMessage: `This advisor does not have access to ${area}.`,
    code: "auth.forbidden",
    status: 403,
  });
}

/**
 * History and hotel tools shared by home chat and trip chat.
 * A client's history covers the whole team; otherwise the advisor's own work.
 */
export function createDeskTools(actor: DeskActor): HistoryToolHandlers & HotelToolHandlers {
  return {
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
