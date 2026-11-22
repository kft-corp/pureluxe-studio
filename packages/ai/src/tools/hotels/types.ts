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
   * False = Atlas preferred/guide, or open-GDS (shop via sabre_hotel_code on rates_search).
   */
  contracted: boolean;
  /** rate_layer = shoppable; atlas = guide preferred; open_gds = live discover fill. */
  source: "rate_layer" | "atlas" | "open_gds";
  /** Advisor badge: Contracted = can price; Preferred = guide; Open = GDS browse/shop. */
  badge: "Contracted" | "Preferred" | "Open";
  /** PureLuxe properties.id when known; null for open_gds browse. */
  property_id: string | null;
  /** Sabre hotel code for open_gds rows (Stage 5 discover / Stage 6 shop); null otherwise. */
  sabre_hotel_code: string | null;
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
   * Ranking only — never invent; never show in chat (including to advisors).
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
    /** True = coverage probe only (no open-GDS discover fill). */
    skipOpenGds?: boolean;
    /** Trip adults — Studio injects for matrix ranking. */
    adults?: number;
    /** Trip children + infants — Studio injects for matrix ranking. */
    children?: number;
    /** Advisor ask / query text for style tilt. */
    ask?: string;
    /** Client preference / diet labels from the lead profile. */
    prefHints?: string[];
    /** Trip stay check-in — Studio injects for open-GDS discover inventory. */
    checkIn?: string | null;
    /** Trip stay check-out — Studio injects for open-GDS discover inventory. */
    checkOut?: string | null;
  }) => Promise<HotelFindResult>;
};
