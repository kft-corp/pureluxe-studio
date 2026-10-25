/** Trip Builder still owns hotel, dates, guests, cost, and cancellation on this row. */
export function tripBuilderOwnsStay(booking: {
  source: string;
  status: string;
}): boolean {
  return (
    booking.source === "trip_builder" &&
    (booking.status === "pending" || booking.status === "on_hold")
  );
}

/**
 * Stay shape, supplier cost, and client price stay with Trip Builder until
 * the stay is confirmed. After confirm, Bookings owns client price corrections
 * (currency still locked via pricing_locked after quote accept).
 */
export const TRIP_BUILDER_OWNED_FIELDS = [
  "title",
  "hotel_name",
  "city",
  "country",
  "start_date",
  "end_date",
  "nights",
  "num_rooms",
  "num_adults",
  "num_children",
  "cost_amount",
  "currency",
  "sell_amount",
  "cancellation_policy",
] as const;

/**
 * Currency stays fixed once the client accepted the quote.
 * Stay client price is editable in Bookings only after the stay is confirmed.
 */
export const PRICING_LOCK_FIELDS = ["currency"] as const;
