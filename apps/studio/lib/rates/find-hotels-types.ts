import type {
  HotelPriceTier,
  KbHotelGuideScoreFactors,
} from "@pureluxe/db";

export type FindHotelsInput = {
  name?: string | null;
  destination?: string | null;
  tier?: HotelPriceTier | null;
  /** Hotel name to match style and tier against. */
  similarTo?: string | null;
  /** Hotel name whose price band others should match. */
  priceBandLike?: string | null;
  limit?: number;
  /** False for silent coverage probes — skip experience bank. Default true. */
  includeExperiences?: boolean;
  /**
   * True for silent coverage_check: Rate Layer + Atlas only — do not call
   * open-GDS discover. Default false (explicit suggest may fill when thin).
   */
  skipOpenGds?: boolean;
  /** Adults on the open trip — tilts matrix ranking behind the scenes. */
  adults?: number | null;
  /** Children + infants on the open trip. */
  children?: number | null;
  /** Advisor ask text (or destination/query) for style tilt — romantic, spa, family, … */
  ask?: string | null;
  /** Client preference / diet labels from the lead profile. */
  prefHints?: string[] | null;
  /**
   * @deprecated Ignored by open-GDS Hotel Search fill (no stay dates).
   * Kept for call-site compatibility.
   */
  checkIn?: string | null;
  /**
   * @deprecated Ignored by open-GDS Hotel Search fill (no stay dates).
   * Kept for call-site compatibility.
   */
  checkOut?: string | null;
};

export type FoundHotel = {
  name: string;
  destination: string | null;
  city: string | null;
  country: string | null;
  tier: HotelPriceTier | null;
  style_tags: string[];
  score: number;
  /**
   * True when Rate Layer can shop this hotel (properties row).
   * False = Atlas preferred/guide, or open-GDS (shop via sabre_hotel_code).
   */
  contracted: boolean;
  /** Where the hit came from. */
  source: "rate_layer" | "atlas" | "open_gds";
  /** Advisor-facing badge: Contracted = shoppable; Preferred = guide; Open = live GDS. */
  badge: "Contracted" | "Preferred" | "Open";
  /**
   * PureLuxe properties.id when known (Rate Layer / linked Atlas).
   * Null for open-GDS browse rows.
   */
  property_id: string | null;
  /**
   * Sabre hotel code for open-GDS rows (Stage 5 discover / Stage 6 shop).
   * Null for Rate Layer / Atlas — mapped codes live in property_supplier_codes.
   */
  sabre_hotel_code: string | null;
  /** Neighbourhood / guide area when known. */
  area: string | null;
  /** Partner / consortia label when known. */
  partner: string | null;
  /** One-line why from Atlas advisor take / description. */
  why: string | null;
  /** Short "choose if" fit line. */
  choose_if: string | null;
  /** Destination-guide internal score when known (ranking only — never show in chat). */
  guide_rating: number | null;
  /** Internal guide matrix factors (full-name keys); for why/compare — never clients. */
  guide_score_factors: KbHotelGuideScoreFactors;
};

export type FoundExperience = {
  kind: "activity" | "restaurant";
  name: string;
  city: string | null;
  guide_type: string | null;
  who_it_suits: string | null;
  lead_time: string | null;
  veg_jain: string | null;
  why: string | null;
};

export type FindHotelsResult = {
  hotels: FoundHotel[];
  /** Curated activities + restaurants for the place (empty when none / skipped). */
  experiences: FoundExperience[];
  /** Suggested names when the query was unclear. */
  did_you_mean: string[];
  note: string | null;
};
