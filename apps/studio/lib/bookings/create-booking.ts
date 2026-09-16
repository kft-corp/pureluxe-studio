import {
  insertBooking,
  insertBookingAuditLogs,
  insertBookingTraveller,
} from "@pureluxe/db";
import {
  type CreateBookingInput,
} from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { buildBookingDetail, type BookingDetail } from "./booking-detail";
import { nightsBetween } from "./booking-dates";

function cleanServiceDetails(
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!patch) return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === "" || value === undefined || value === null) continue;
    next[key] = value;
  }
  return next;
}

/**
 * Studio New booking — offline / orphan inventory.
 * Forces `source = manual`, defaults owner to the actor,
 * seeds lead traveller from the primary client, returns detail.
 */
export async function createBooking(
  input: CreateBookingInput,
  actor: { memberId: string },
): Promise<BookingDetail> {
  const client = await requireActiveClient(input.client_id);

  const relationshipOwnerId = input.relationship_owner_id ?? actor.memberId;

  const startDate = input.start_date ?? null;
  const endDate = input.end_date ?? null;
  const nights = input.nights ?? nightsBetween(startDate, endDate);

  const booking = await insertBooking({
    client_id: input.client_id,
    trip_id: input.trip_id ?? null,
    trip_leg_id: input.trip_leg_id ?? null,
    trip_line_item_id: null,
    service_type: input.service_type,
    relationship_owner_id: relationshipOwnerId,
    booked_by_id: actor.memberId,
    source: "manual",
    title: input.title,
    property_id: null,
    hotel_name: input.hotel_name ?? null,
    city: input.city ?? null,
    country: input.country ?? null,
    chain: input.chain ?? null,
    start_date: startDate,
    end_date: endDate,
    nights,
    num_rooms: input.num_rooms ?? null,
    num_adults: input.num_adults ?? null,
    num_children: input.num_children ?? null,
    supplier_name: input.supplier_name ?? null,
    supplier_ref: input.supplier_ref ?? null,
    booking_channel: input.booking_channel ?? null,
    currency: input.currency ?? null,
    cost_amount: input.cost_amount ?? null,
    sell_amount: input.sell_amount ?? null,
    commission_expected: input.commission_expected ?? null,
    status: input.status,
    confirmed_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    cancellation_deadline: input.cancellation_deadline ?? null,
    cancellation_policy: input.cancellation_policy ?? null,
    ticket_time_limit: input.ticket_time_limit ?? null,
    amended_from_id: null,
    guest_visible: false,
    guest_notes: null,
    internal_notes: input.internal_notes ?? null,
    confirmation_file_path: null,
    service_details: cleanServiceDetails(input.service_details),
    vip_flag: input.vip_flag,
    special_occasion: null,
  });

  const leadName = client.display_name.trim() || "Lead traveller";
  const leadTraveller = await insertBookingTraveller({
    booking_id: booking.id,
    client_id: client.id,
    title: client.title,
    full_name: leadName,
    gender: null,
    role: "lead",
    date_of_birth: null,
    passport_number: null,
    passport_nationality: null,
    passport_expiry: null,
  });

  const [, detail] = await Promise.all([
    insertBookingAuditLogs([
      {
        booking_id: booking.id,
        action: "created",
        field_name: null,
        old_value: null,
        new_value: null,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          create_source: "manual",
          service_type: booking.service_type,
          client_id: booking.client_id,
        },
      },
      {
        booking_id: booking.id,
        action: "traveller_created",
        field_name: "travellers",
        old_value: null,
        new_value: leadTraveller.full_name,
        performed_by: "team",
        team_member_id: actor.memberId,
        metadata: {
          source: "studio",
          auto_seeded_lead: true,
          traveller_id: leadTraveller.id,
          client_id: client.id,
        },
      },
    ]),
    buildBookingDetail(booking),
  ]);

  return detail;
}
