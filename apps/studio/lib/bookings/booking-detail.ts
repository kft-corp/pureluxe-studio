import {
  findTeamMemberById,
  findClientDisplayNamesByIds,
  listBookingAuditLogs,
  listBookingTravellers,
  type Booking,
  type BookingAuditLog,
  type BookingTraveller,
} from "@pureluxe/db";

import { BOOKING_DETAIL_LIST_LIMITS } from "./booking-limits";
import { requireActiveBooking } from "./require-active-booking";

export type BookingDetail = {
  booking: Booking & {
    client: { id: string; display_name: string } | null;
    relationship_owner: { id: string; name: string } | null;
    booked_by: { id: string; name: string } | null;
  };
  travellers: BookingTraveller[];
  recent_audit: BookingAuditLog[];
};

/** Assemble Studio detail from a booking row (skips a second bookings fetch). */
export async function buildBookingDetail(
  booking: Booking,
): Promise<BookingDetail> {
  const [owner, bookedBy, travellers, recentAudit, clientNames] =
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
      listBookingAuditLogs(booking.id, BOOKING_DETAIL_LIST_LIMITS.audit),
      booking.client_id
        ? findClientDisplayNamesByIds([booking.client_id])
        : Promise.resolve(new Map<string, string>()),
    ]);

  return {
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
    },
    travellers,
    recent_audit: recentAudit,
  };
}

/** Full Studio booking detail — travellers + recent audit capped. */
export async function getBookingDetail(
  bookingId: string,
): Promise<BookingDetail> {
  const booking = await requireActiveBooking(bookingId);
  return buildBookingDetail(booking);
}
