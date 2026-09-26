import {
  findTeamMemberById,
  findClientDisplayNamesByIds,
  findSuccessorBookingId,
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

export type BookingDetail = {
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
  const [owner, bookedBy, travellers, auditPage, clientNames, successorId] =
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
