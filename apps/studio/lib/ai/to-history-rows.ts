import type { BookingBrief, BookingHistoryRow, TripHistoryRow } from "@pureluxe/ai";
import type { BookingDirectoryRow, JourneyCard } from "@pureluxe/db";

import type { BookingDetail } from "@/lib/bookings";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Trips board card → search_trips row. */
export function toTripHistoryRow(card: JourneyCard): TripHistoryRow {
  return {
    trip_id: card.id,
    title: card.title,
    status: card.status,
    client: card.client?.display_name ?? null,
    owner: card.owner?.name ?? null,
    starts_on: card.starts_on,
    ends_on: card.ends_on,
    destinations: card.destinations,
    traveller_count: card.traveller_count,
    sell_total: card.sell_total,
    sell_currency: card.sell_currency,
    margin: card.margin_internal,
    pricing_locked: card.pricing_locked,
    quote_out_of_date: card.proposal_stale,
  };
}

/** Bookings directory row → search_bookings row. */
export function toBookingHistoryRow(row: BookingDirectoryRow): BookingHistoryRow {
  return {
    booking_id: row.id,
    title: row.title,
    service_type: row.service_type,
    status: row.status,
    client: row.client_name,
    hotel_name: row.hotel_name,
    city: row.city,
    start_date: row.start_date,
    end_date: row.end_date,
    nights: row.nights,
    confirmation_ref: text(row.supplier_ref),
    cancellation_deadline: row.cancellation_deadline,
    on_a_trip: Boolean(row.trip_id),
  };
}

function freeCancellation(deadline: string | null, today: string): BookingBrief["free_cancellation"] {
  if (!deadline) return "unknown";
  return deadline.slice(0, 10) >= today ? "open" : "passed";
}

/** Studio booking detail → get_booking brief. */
export function toBookingBrief(detail: BookingDetail, today: string): BookingBrief {
  const { booking } = detail;
  const details = booking.service_details;
  const margin =
    booking.sell_amount != null && booking.cost_amount != null
      ? Math.round((booking.sell_amount - booking.cost_amount) * 100) / 100
      : null;

  return {
    booking_id: booking.id,
    title: booking.title,
    service_type: booking.service_type,
    status: booking.status,
    client: booking.client?.display_name ?? null,
    hotel_name: booking.hotel_name,
    city: booking.city,
    country: booking.country,
    start_date: booking.start_date,
    end_date: booking.end_date,
    nights: booking.nights,
    rooms: booking.num_rooms,
    adults: booking.num_adults,
    children: booking.num_children,
    room_type: text(details.room_type),
    board: text(details.board_basis_label) ?? text(details.board_basis),
    supplier: booking.supplier_name,
    confirmation_ref: text(booking.supplier_ref),
    booking_channel: booking.booking_channel,
    currency: booking.currency,
    team_cost: booking.cost_amount,
    client_price: booking.sell_amount,
    margin,
    commission_expected: booking.commission_expected,
    cancellation_policy: booking.cancellation_policy,
    cancellation_deadline: booking.cancellation_deadline,
    free_cancellation: freeCancellation(booking.cancellation_deadline, today),
    confirmed_at: booking.confirmed_at,
    cancelled_at: booking.cancelled_at,
    cancellation_reason: booking.cancellation_reason,
    amended_from_earlier: Boolean(booking.amended_from_id),
    travellers: detail.travellers.map((person) => ({
      name: person.full_name,
      role: person.role,
      passport_expiry: person.passport_expiry,
    })),
  };
}
