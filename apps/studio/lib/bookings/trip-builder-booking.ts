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

export const PRICING_LOCK_FIELDS = [
  "cost_amount",
  "currency",
  "sell_amount",
] as const;
