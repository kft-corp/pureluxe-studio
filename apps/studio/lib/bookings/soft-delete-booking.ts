import {
  insertBookingAuditLogs,
  updateBooking as dbUpdateBooking,
} from "@pureluxe/db";
import { AppError, bookingMessages } from "@pureluxe/shared";

import { requireEditableBooking } from "./require-active-booking";

/**
 * Soft-delete a booking — sets deleted_at; row stays for audit.
 * Prefer Cancel for supplier-side cancellations; use this to remove mistaken ledger rows.
 */
export async function softDeleteBooking(
  bookingId: string,
  actor: { memberId: string },
): Promise<void> {
  const existing = await requireEditableBooking(bookingId);

  if (existing.deleted_at) {
    throw new AppError({
      userMessage: bookingMessages.error.alreadyDeleted,
      code: "bookings.already_deleted",
      status: 400,
    });
  }

  const now = new Date().toISOString();
  await dbUpdateBooking({ id: bookingId, deleted_at: now });

  await insertBookingAuditLogs([
    {
      booking_id: bookingId,
      action: "deleted",
      field_name: "deleted_at",
      old_value: null,
      new_value: now,
      performed_by: "team",
      team_member_id: actor.memberId,
      metadata: {
        source: "studio",
        soft_delete: true,
        previous_status: existing.status,
      },
    },
  ]);
}
