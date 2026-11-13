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

export type HotelPriceTier = "Tier 1" | "Tier 2" | "Tier 3";

/** Internal guide matrix keys (full names) from hotel_find. */
export type HotelGuideScoreFactors = Partial<
  Record<
    | "luxury"
    | "support"
    | "rooms"
    | "food_and_beverage"
    | "neighbourhood"
    | "access"
    | "service"
    | "character"
    | "wellness"
    | "family"
    | "indian_client_fit"
    | "value"
    | "views_and_privacy"
    | "consistency",
    number
  >
>;

/** One hotel from hotel_find (suggestions and fuzzy search). */
export type HotelFindHit = {
  name: string;
  destination: string | null;
  city: string | null;
  country: string | null;
  tier: HotelPriceTier | null;
  style_tags: string[];
  score: number;
  /**
   * True when Rate Layer can shop rates (properties / linked).
   * False = Atlas preferred/guide only — name OK to suggest; rates need paste/GDS/link.
   */
  contracted: boolean;
  /** rate_layer = shoppable inventory; atlas = destination-guide preferred list. */
  source: "rate_layer" | "atlas";
  /** Advisor badge: Contracted = can price; Preferred = guide list only. */
  badge: "Contracted" | "Preferred";
  /** Neighbourhood / guide area when known. */
  area: string | null;
  /** Partner / consortia label when known. */
  partner: string | null;
  /** One-line why from Atlas. */
  why: string | null;
  /** Short "choose if" fit line. */
  choose_if: string | null;
  /**
   * Destination-guide internal score (typically ~1–5) when known.
   * Advisor-facing only — never invent; omit in chat when null.
   */
  guide_rating: number | null;
  /**
   * Internal guide matrix (full-name keys, 1–5). Use when advisor asks why / compare.
   * Never invent; never show to clients; omit empty.
   */
  guide_score_factors: HotelGuideScoreFactors;
};

/** Activity or restaurant paired with a hotel shortlist. */
export type HotelFindExperience = {
  kind: "activity" | "restaurant";
  name: string;
  city: string | null;
  guide_type: string | null;
  who_it_suits: string | null;
  lead_time: string | null;
  veg_jain: string | null;
  why: string | null;
};

export type HotelFindResult = {
  hotels: HotelFindHit[];
  /** Curated activities + restaurants for the place (empty when none / coverage check). */
  experiences: HotelFindExperience[];
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
    /** False skips the experience bank (silent coverage probes). Default true. */
    includeExperiences?: boolean;
  }) => Promise<HotelFindResult>;
};
