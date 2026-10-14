/** One hotel from get_hotel. */
export type HotelBrief = {
  name: string;
  city: string | null;
  country: string | null;
  /** True when PureLuxe has at least one active contract for the hotel. */
  contracted: boolean;
  /**
   * Check-in times, stay rules, cancellation, payment, transfers, benefits,
   * required charges, extras, offers, and minimum markup already on file.
   * Null when nothing is on file.
   */
  facts: string | null;
};

/**
 * Host callbacks for hotel lookups.
 * Studio injects these — @pureluxe/ai never hits DB.
 */
export type HotelToolHandlers = {
  getHotel: (input: {
    name: string;
    checkIn?: string;
    checkOut?: string;
  }) => Promise<{ hotels: HotelBrief[] }>;
};
