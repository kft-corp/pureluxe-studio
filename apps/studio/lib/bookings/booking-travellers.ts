import {
  deleteBookingTraveller as dbDeleteTraveller,
  findBookingTravellerById,
  insertBookingAuditLogs,
  insertBookingTraveller as dbInsertTraveller,
  listBookingTravellers,
  updateBookingTraveller as dbUpdateTraveller,
} from "@pureluxe/db";
import {
  AppError,
  bookingMessages,
  type CreateBookingTravellerInput,
  type UpdateBookingTravellerInput,
} from "@pureluxe/shared";

import { buildBookingDetail, type BookingDetail } from "./booking-detail";
import { isLeadTravellerRole } from "./booking-format";
import { requireEditableBooking } from "./require-active-booking";

/** Add a traveller; returns full booking detail. */
export async function createBookingTraveller(
  bookingId: string,
  input: CreateBookingTravellerInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const booking = await requireEditableBooking(bookingId);

  const traveller = await dbInsertTraveller({
    booking_id: bookingId,
    ...input,
  });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "traveller_created",
        field_name: "travellers",
        old_value: null,
        new_value: traveller.full_name,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", traveller_id: traveller.id },
      },
    ]),
    buildBookingDetail(booking),
  ]);

  return detail;
}

/** Update a traveller; returns full booking detail. */
export async function updateBookingTraveller(
  bookingId: string,
  travellerId: string,
  input: UpdateBookingTravellerInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const booking = await requireEditableBooking(bookingId);

  const existing = await findBookingTravellerById(travellerId);
  if (!existing || existing.booking_id !== bookingId) {
    throw new AppError({
      userMessage: bookingMessages.error.travellerNotFound,
      code: "bookings.traveller_not_found",
      status: 404,
    });
  }

  await dbUpdateTraveller({
    id: travellerId,
    booking_id: bookingId,
    ...input,
  });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "traveller_updated",
        field_name: "travellers",
        old_value: existing.full_name,
        new_value: input.full_name ?? existing.full_name,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", traveller_id: travellerId },
      },
    ]),
    buildBookingDetail(booking),
  ]);

  return detail;
}

/** Remove a traveller; returns full booking detail. */
export async function deleteBookingTraveller(
  bookingId: string,
  travellerId: string,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const booking = await requireEditableBooking(bookingId);

  const existing = await findBookingTravellerById(travellerId);
  if (!existing || existing.booking_id !== bookingId) {
    throw new AppError({
      userMessage: bookingMessages.error.travellerNotFound,
      code: "bookings.traveller_not_found",
      status: 404,
    });
  }

  const travellers = await listBookingTravellers(bookingId, 100);
  if (travellers.length <= 1) {
    throw new AppError({
      userMessage: bookingMessages.error.cannotRemoveLastTraveller,
      code: "bookings.cannot_remove_last_traveller",
      status: 400,
    });
  }

  const isLead = isLeadTravellerRole(existing.role);
  if (isLead) {
    const otherLeads = travellers.filter(
      (row) => row.id !== travellerId && isLeadTravellerRole(row.role),
    );
    if (otherLeads.length === 0) {
      throw new AppError({
        userMessage: bookingMessages.error.cannotRemoveLead,
        code: "bookings.cannot_remove_lead",
        status: 400,
      });
    }
  }

  await dbDeleteTraveller({ id: travellerId, booking_id: bookingId });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "traveller_removed",
        field_name: "travellers",
        old_value: existing.full_name,
        new_value: null,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", traveller_id: travellerId },
      },
    ]),
    buildBookingDetail(booking),
  ]);

  return detail;
}
