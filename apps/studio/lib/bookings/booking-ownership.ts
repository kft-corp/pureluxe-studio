import {
  insertBookingAuditLogs,
  updateBooking as dbUpdateBooking,
} from "@pureluxe/db";
import {
  type AssignBookingOwnerInput,
  type LinkBookingTripInput,
} from "@pureluxe/shared";

import { buildBookingDetail, type BookingDetail } from "./booking-detail";
import { requireEditableBooking } from "./require-active-booking";

/** Assign / clear relationship owner. */
export async function assignBookingOwner(
  bookingId: string,
  input: AssignBookingOwnerInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const existing = await requireEditableBooking(bookingId);

  if (existing.relationship_owner_id === input.relationship_owner_id) {
    return buildBookingDetail(existing);
  }

  const updated = await dbUpdateBooking({
    id: bookingId,
    relationship_owner_id: input.relationship_owner_id,
  });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "assigned",
        field_name: "relationship_owner_id",
        old_value: existing.relationship_owner_id,
        new_value: input.relationship_owner_id,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio" },
      },
    ]),
    buildBookingDetail(updated),
  ]);

  return detail;
}

/** Link / unlink trip (+ optional leg) from Context. */
export async function linkBookingTrip(
  bookingId: string,
  input: LinkBookingTripInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const existing = await requireEditableBooking(bookingId);

  const patch: Record<string, unknown> = {};
  const fieldChanges: Record<
    string,
    { old_value: string | null; new_value: string | null }
  > = {};

  if (input.trip_id !== undefined && input.trip_id !== existing.trip_id) {
    patch.trip_id = input.trip_id;
    fieldChanges.trip_id = {
      old_value: existing.trip_id,
      new_value: input.trip_id,
    };
    if (input.trip_id === null && input.trip_leg_id === undefined) {
      patch.trip_leg_id = null;
      if (existing.trip_leg_id) {
        fieldChanges.trip_leg_id = {
          old_value: existing.trip_leg_id,
          new_value: null,
        };
      }
    }
  }

  if (
    input.trip_leg_id !== undefined &&
    input.trip_leg_id !== existing.trip_leg_id
  ) {
    patch.trip_leg_id = input.trip_leg_id;
    fieldChanges.trip_leg_id = {
      old_value: existing.trip_leg_id,
      new_value: input.trip_leg_id,
    };
  }

  if (Object.keys(patch).length === 0) {
    return buildBookingDetail(existing);
  }

  const updated = await dbUpdateBooking({ id: bookingId, ...patch });
  const changed = Object.keys(fieldChanges);

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "updated",
        field_name: changed.length === 1 ? changed[0]! : "booking",
        old_value:
          changed.length === 1
            ? (fieldChanges[changed[0]!]?.old_value ?? null)
            : null,
        new_value:
          changed.length === 1
            ? (fieldChanges[changed[0]!]?.new_value ?? null)
            : null,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", fields: fieldChanges },
      },
    ]),
    buildBookingDetail(updated),
  ]);

  return detail;
}
