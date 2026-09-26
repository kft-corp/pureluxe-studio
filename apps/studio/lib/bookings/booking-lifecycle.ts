import {
  insertBooking,
  insertBookingAuditLogs,
  insertBookingTraveller,
  listBookingTravellers,
  updateBooking as dbUpdateBooking,
} from "@pureluxe/db";
import {
  AppError,
  bookingMessages,
  type CancelBookingInput,
  type ConfirmBookingInput,
} from "@pureluxe/shared";

import { buildBookingDetail, type BookingDetail } from "./booking-detail";
import { requireEditableBooking } from "./require-active-booking";

const CONFIRMABLE = new Set(["pending", "on_hold"]);
const CANCELABLE = new Set(["pending", "on_hold", "confirmed"]);
const AMENDABLE = new Set(["pending", "on_hold", "confirmed"]);

/** Confirm a pending/on-hold booking; optional ref + deadlines. */
export async function confirmBooking(
  bookingId: string,
  input: ConfirmBookingInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const existing = await requireEditableBooking(bookingId);

  if (existing.status === "confirmed") {
    throw new AppError({
      userMessage: bookingMessages.error.alreadyConfirmed,
      code: "bookings.already_confirmed",
      status: 400,
    });
  }
  if (!CONFIRMABLE.has(existing.status)) {
    throw new AppError({
      userMessage: bookingMessages.error.cannotConfirm,
      code: "bookings.cannot_confirm",
      status: 400,
    });
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: "confirmed",
    confirmed_at: existing.confirmed_at ?? now,
  };
  if (input.supplier_ref !== undefined) {
    patch.supplier_ref = input.supplier_ref;
  }
  if (input.cancellation_deadline !== undefined) {
    patch.cancellation_deadline = input.cancellation_deadline;
  }
  if (input.ticket_time_limit !== undefined) {
    patch.ticket_time_limit = input.ticket_time_limit;
  }

  const updated = await dbUpdateBooking({ id: bookingId, ...patch });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "confirmed",
        field_name: "status",
        old_value: existing.status,
        new_value: "confirmed",
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", fields: patch },
      },
    ]),
    buildBookingDetail(updated),
  ]);

  return detail;
}

/** Cancel a booking with a required ops reason. */
export async function cancelBooking(
  bookingId: string,
  input: CancelBookingInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const existing = await requireEditableBooking(bookingId);

  if (existing.status === "cancelled") {
    throw new AppError({
      userMessage: bookingMessages.error.alreadyCancelled,
      code: "bookings.already_cancelled",
      status: 400,
    });
  }
  if (!CANCELABLE.has(existing.status)) {
    throw new AppError({
      userMessage: bookingMessages.error.cannotCancel,
      code: "bookings.cannot_cancel",
      status: 400,
    });
  }

  const now = new Date().toISOString();
  const updated = await dbUpdateBooking({
    id: bookingId,
    status: "cancelled",
    cancelled_at: existing.cancelled_at ?? now,
    cancellation_reason: input.cancellation_reason,
  });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: bookingId,
        action: "cancelled",
        field_name: "status",
        old_value: existing.status,
        new_value: "cancelled",
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          cancellation_reason: input.cancellation_reason,
        },
      },
    ]),
    buildBookingDetail(updated),
  ]);

  return detail;
}

/**
 * Amend = supersede: copy inventory to a new booking, mark prior superseded.
 * Returns the **new** booking detail.
 */
export async function supersedeBooking(
  bookingId: string,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const existing = await requireEditableBooking(bookingId);

  if (!AMENDABLE.has(existing.status)) {
    throw new AppError({
      userMessage: bookingMessages.error.cannotAmend,
      code: "bookings.cannot_amend",
      status: 400,
    });
  }

  const travellers = await listBookingTravellers(bookingId, 50);

  const created = await insertBooking({
    client_id: existing.client_id,
    trip_id: existing.trip_id,
    trip_leg_id: existing.trip_leg_id,
    trip_line_item_id: existing.trip_line_item_id,
    service_type: existing.service_type,
    relationship_owner_id: existing.relationship_owner_id,
    booked_by_id: actor.memberId,
    source: existing.source,
    title: existing.title,
    property_id: existing.property_id,
    hotel_name: existing.hotel_name,
    city: existing.city,
    country: existing.country,
    chain: existing.chain,
    start_date: existing.start_date,
    end_date: existing.end_date,
    nights: existing.nights,
    num_rooms: existing.num_rooms,
    num_adults: existing.num_adults,
    num_children: existing.num_children,
    supplier_name: existing.supplier_name,
    supplier_ref: existing.supplier_ref,
    booking_channel: existing.booking_channel,
    currency: existing.currency,
    cost_amount: existing.cost_amount,
    sell_amount: existing.sell_amount,
    commission_expected: existing.commission_expected,
    status: existing.status === "confirmed" ? "pending" : existing.status,
    confirmed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    cancellation_deadline: existing.cancellation_deadline,
    cancellation_policy: existing.cancellation_policy,
    ticket_time_limit: existing.ticket_time_limit,
    amended_from_id: existing.id,
    guest_visible: false,
    guest_notes: existing.guest_notes,
    internal_notes: existing.internal_notes,
    confirmation_file_path: null,
    service_details: { ...existing.service_details },
    vip_flag: existing.vip_flag,
    special_occasion: existing.special_occasion,
  });

  await Promise.all([
    dbUpdateBooking({ id: existing.id, status: "superseded" }),
    ...travellers.map((traveller) =>
      insertBookingTraveller({
        booking_id: created.id,
        client_id: traveller.client_id,
        title: traveller.title,
        full_name: traveller.full_name,
        gender: traveller.gender,
        role: traveller.role,
        date_of_birth: traveller.date_of_birth,
        passport_number: traveller.passport_number,
        passport_nationality: traveller.passport_nationality,
        passport_expiry: traveller.passport_expiry,
      }),
    ),
    insertBookingAuditLogs([
      {
        booking_id: existing.id,
        action: "superseded",
        field_name: "status",
        old_value: existing.status,
        new_value: "superseded",
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", amended_to_id: created.id },
      },
      {
        booking_id: created.id,
        action: "created",
        field_name: "amended_from_id",
        old_value: null,
        new_value: existing.id,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: { source: "studio", amended_from_id: existing.id },
      },
    ]),
  ]);

  return buildBookingDetail(created);
}
