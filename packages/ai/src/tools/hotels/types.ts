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

export type HotelPriceTier = "ultra_luxury" | "luxury" | "premium";

/** One hotel from hotel_find (suggestions and fuzzy search). */
export type HotelFindHit = {
  name: string;
  destination: string | null;
  city: string | null;
  country: string | null;
  tier: HotelPriceTier | null;
  style_tags: string[];
  score: number;
  /** Always true: results are PureLuxe Rate Layer hotels only. */
  contracted: true;
};

export type HotelFindResult = {
  hotels: HotelFindHit[];
  /** Suggested names when the typed name was unclear. */
  did_you_mean: string[];
  note: string | null;
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
  findHotels: (input: {
    name?: string;
    destination?: string;
    tier?: HotelPriceTier;
    similarTo?: string;
    priceBandLike?: string;
    limit?: number;
  }) => Promise<HotelFindResult>;
};
