/** One trip from search_trips. */
export type TripHistoryRow = {
  trip_id: string;
  title: string | null;
  status: string;
  client: string | null;
  owner: string | null;
  starts_on: string | null;
  ends_on: string | null;
  destinations: string[];
  traveller_count: number;
  sell_total: number | null;
  sell_currency: string | null;
  /** Client price minus team cost. Null until priced. */
  margin: number | null;
  pricing_locked: boolean;
  quote_out_of_date: boolean;
};

/** One booking from search_bookings. */
export type BookingHistoryRow = {
  booking_id: string;
  title: string;
  service_type: string;
  status: string;
  client: string | null;
  hotel_name: string | null;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  confirmation_ref: string | null;
  cancellation_deadline: string | null;
  on_a_trip: boolean;
};

/** One booking in full for get_booking. */
export type BookingBrief = {
  booking_id: string;
  title: string;
  service_type: string;
  status: string;
  client: string | null;
  hotel_name: string | null;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  nights: number | null;
  rooms: number | null;
  adults: number | null;
  children: number | null;
  room_type: string | null;
  board: string | null;
  supplier: string | null;
  confirmation_ref: string | null;
  booking_channel: string | null;
  currency: string | null;
  team_cost: number | null;
  client_price: number | null;
  /** client_price minus team_cost. Null when either is missing. */
  margin: number | null;
  commission_expected: number | null;
  cancellation_policy: string | null;
  cancellation_deadline: string | null;
  /**
   * open: today is on or before the free-cancel deadline.
   * passed: the deadline is behind us, so the policy penalty applies.
   * unknown: no deadline on the booking.
   */
  free_cancellation: "open" | "passed" | "unknown";
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  /** This booking replaced an earlier one after an amend. */
  amended_from_earlier: boolean;
  travellers: Array<{
    name: string;
    role: string;
    passport_expiry: string | null;
  }>;
};

export type SearchTripsInput = {
  clientId?: string;
  query?: string;
  stage?: string;
  mine?: boolean;
  limit?: number;
};

export type SearchBookingsInput = {
  clientId?: string;
  query?: string;
  work?: string;
  status?: string;
  mine?: boolean;
  limit?: number;
};

/**
 * Host callbacks for trip and booking history.
 * Studio injects these — @pureluxe/ai never hits DB.
 */
export type HistoryToolHandlers = {
  searchTrips: (
    input: SearchTripsInput,
  ) => Promise<{ trips: TripHistoryRow[]; total: number }>;
  searchBookings: (
    input: SearchBookingsInput,
  ) => Promise<{ bookings: BookingHistoryRow[]; total: number }>;
  getBooking: (input: { bookingId: string }) => Promise<BookingBrief>;
};
