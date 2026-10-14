import {
  findTeamMemberById,
  findClientDisplayNamesByIds,
  findSuccessorBookingId,
  findTripById,
  listBookingTravellers,
  type Booking,
  type BookingTraveller,
} from "@pureluxe/db";

import {
  listRecentBookingActivity,
  type BookingAuditEntry,
} from "./booking-activity";
import { BOOKING_DETAIL_LIST_LIMITS } from "./booking-limits";
import { requireActiveBooking } from "./require-active-booking";

export type BookingTripCommercial = {
  sell_total: number | null;
  sell_currency: string | null;
  cost_total_internal: number | null;
  margin_internal: number | null;
  pricing_locked: boolean;
};

function asMoney(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export type BookingDetail = {
  trip: BookingTripCommercial | null;
  booking: Booking & {
    client: { id: string; display_name: string } | null;
    relationship_owner: { id: string; name: string } | null;
    booked_by: { id: string; name: string } | null;
    /** Set when this row was superseded by an amend. */
    successor_booking_id: string | null;
  };
  travellers: BookingTraveller[];
  recent_audit: BookingAuditEntry[];
  recent_audit_total: number;
};

/** Assemble Studio detail from a booking row (skips a second bookings fetch). */
export async function buildBookingDetail(
  booking: Booking,
): Promise<BookingDetail> {
  const [owner, bookedBy, travellers, auditPage, clientNames, successorId, trip] =
    await Promise.all([
      booking.relationship_owner_id
        ? findTeamMemberById(booking.relationship_owner_id)
        : Promise.resolve(null),
      booking.booked_by_id
        ? findTeamMemberById(booking.booked_by_id)
        : Promise.resolve(null),
      listBookingTravellers(
        booking.id,
        BOOKING_DETAIL_LIST_LIMITS.travellers,
      ),
      listRecentBookingActivity(booking.id),
      booking.client_id
        ? findClientDisplayNamesByIds([booking.client_id])
        : Promise.resolve(new Map<string, string>()),
      booking.status === "superseded"
        ? findSuccessorBookingId(booking.id)
        : Promise.resolve(null),
      booking.trip_id ? findTripById(booking.trip_id) : Promise.resolve(null),
    ]);

  return {
    trip: trip
      ? {
          sell_total: asMoney(trip.sell_total),
          sell_currency: trip.sell_currency,
          cost_total_internal: asMoney(trip.cost_total_internal),
          margin_internal: asMoney(trip.margin_internal),
          pricing_locked: Boolean(trip.pricing_locked_at),
        }
      : null,
    booking: {
      ...booking,
      client: booking.client_id
        ? {
            id: booking.client_id,
            display_name:
              clientNames.get(booking.client_id) ?? "Unnamed client",
          }
        : null,
      relationship_owner: owner
        ? { id: owner.id, name: owner.name }
        : null,
      booked_by: bookedBy
        ? { id: bookedBy.id, name: bookedBy.name }
        : null,
      successor_booking_id: successorId,
    },
    travellers,
    recent_audit: auditPage.activity,
    recent_audit_total: auditPage.total,
  };
}

/** Full Studio booking detail — travellers + recent audit capped. */
export async function getBookingDetail(
  bookingId: string,
): Promise<BookingDetail> {
  const booking = await requireActiveBooking(bookingId);
  return buildBookingDetail(booking);
}
