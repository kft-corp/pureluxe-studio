/**
 * Atlas Knowledge Base row types — matches supabase/migrations/016_atlas_kb.sql.
 * No prices. Rate Layer money stays on properties / trip_line_items.
 */

/** Seeded shape for company_settings.key = knowledge_base (016). */
export type KnowledgeBaseSetting = {
  scrape_enabled: boolean;
  fallback_llm_enabled: boolean;
  guest_review_factcheck_enabled: boolean;
  live_fetch_enabled: boolean;
  llm_general_ttl_days: number;
  /** Default traveller passport when trip has none (ISO 3166-1 alpha-2). */
  default_passport_country_code: string;
};

/** Trust axis — how much we trust the row. Not the same as provenance. */
export type KbTier = "kb_verified" | "kb_scraped" | "llm_general";

/** Who wrote it — not the same as kb_tier. */
export type KbProvenance = "kb" | "llm" | "advisor_direct";

export type KbFactStatus = "draft" | "approved" | "archived";

export type KbEntityType =
  | "hotel"
  | "destination"
  | "restaurant"
  | "activity"
  | "vendor"
  | "other";

export type KbContractStatus =
  | "contracted"
  | "not_yet_contracted"
  | "unknown";

export type KbSourceType =
  | "website"
  | "google_drive"
  | "advisor_note"
  | "hotel_intake"
  | "consortia_portal"
  | "tourism_board"
  | "other";

export type KbVisaEntryType =
  | "visa_free"
  | "e_visa"
  | "visa_on_arrival"
  | "embassy";

export type KbTripStyle =
  | "honeymoon"
  | "family"
  | "business"
  | "solo"
  | "group";

export type KbVendorType = "dmc" | "guide" | "ground_handler" | "other";

export type KbScrapeRunStatus = "ok" | "error" | "skipped";

/** Compose-path gate on trip_legs (016). */
export type KbSelectionStatus = "pending" | "resolved" | "empty";

/** Row from public.kb_regions. */
export type KbRegion = {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_countries. */
export type KbCountry = {
  id: string;
  region_id: string | null;
  name: string;
  /** ISO 3166-1 alpha-2 (JP, IN). */
  country_code: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_cities. */
export type KbCity = {
  id: string;
  country_id: string;
  name: string;
  destination_profile_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_country_facts (1:1 country). No visa. */
export type KbCountryFacts = {
  country_id: string;
  currency_code: string | null;
  currency_notes: string | null;
  /**
   * Short PureLuxe “when to go” summary (peak + value + book-ahead).
   * Full season table lives in kb_country_season_windows.
   */
  best_season: string | null;
  /** Safety / punctuality / closures — etiquette lives in etiquette_notes. */
  safety_notes: string | null;
  /** Short intro / overflow — prefer typed logistics columns. */
  general_notes: string | null;
  /** Flights / open-jaw / preferred airports. */
  getting_there: string | null;
  /** Rail, transfers, luggage, drivers. */
  getting_around: string | null;
  /** Local etiquette (tipping, shoes, onsen…). */
  etiquette_notes: string | null;
  /** Country-level restaurant booking / diet notes (not hotel dining). */
  dining_notes: string | null;
  /** Common advisor pitfalls. */
  pitfalls: string | null;
  /** First-time length + night split. */
  ideal_trip_length: string | null;
  kb_tier: KbTier;
  provenance: KbProvenance;
  advisor_take: string | null;
  advisor_take_updated_by_id: string | null;
  advisor_take_updated_at: string | null;
  verified_by_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

/** peak | shoulder | value | avoid — optional demand signal for Heads-up. */
export type KbSeasonDemandLevel = "peak" | "shoulder" | "value" | "avoid";

/** Row from public.kb_country_season_windows (1:N country). Multi-country season table. */
export type KbCountrySeasonWindow = {
  id: string;
  country_id: string;
  season_key: string | null;
  label: string;
  months_label: string | null;
  month_from: number | null;
  month_to: number | null;
  day_from: number | null;
  day_to: number | null;
  climate_notes: string | null;
  best_for: string | null;
  watch_outs: string | null;
  demand_level: KbSeasonDemandLevel | null;
  book_ahead_notes: string | null;
  sort_order: number;
  kb_tier: KbTier;
  provenance: KbProvenance;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_country_visa_rules (1:N country × passport). */
export type KbCountryVisaRule = {
  id: string;
  country_id: string;
  passport_country_code: string;
  summary: string;
  details: string | null;
  entry_type: KbVisaEntryType | null;
  official_url: string | null;
  /** Advisor-facing fee line (e.g. Rs 3,100 per person). */
  fee_text: string | null;
  /** Typical processing window (e.g. About 2 weeks). */
  processing_text: string | null;
  /** Where to lodge (VFS / embassy). */
  where_to_apply: string | null;
  /** Typical documents (prose or newline / | separated). */
  documents_text: string | null;
  /** PureLuxe advisor tips. */
  advisor_tips: string | null;
  /** Non-default routes (e.g. e-Visa exists but not default). */
  alternate_routes: string | null;
  /** True when this is the PureLuxe default process for this pair. */
  is_pureluxe_default: boolean;
  kb_tier: KbTier;
  provenance: KbProvenance;
  verified_by_id: string | null;
  verified_at: string | null;
  last_reviewed_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_destination_facts (1:1 city). */
export type KbDestinationFacts = {
  city_id: string;
  best_time_to_visit: string | null;
  ideal_length_of_stay: string | null;
  vibe: string | null;
  /** Who / what trips suit this city (guide Best for). Style-specific → audience_notes. */
  best_for: string | null;
  /** Staff / neighbourhood hotel-choice notes — not client-facing by default. */
  staff_notes: string | null;
  kb_tier: KbTier;
  provenance: KbProvenance;
  verified_by_id: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_destination_audience_notes (1:N city × trip style). */
export type KbDestinationAudienceNote = {
  id: string;
  city_id: string;
  trip_style: KbTripStyle;
  note: string;
  kb_tier: KbTier;
  provenance: KbProvenance;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_sources. */
export type KbSource = {
  id: string;
  name: string;
  source_type: KbSourceType;
  url: string | null;
  fetch_method: string | null;
  terms_notes: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_entities. */
export type KbEntity = {
  id: string;
  entity_type: KbEntityType;
  name: string;
  brand: string | null;
  description: string | null;
  advisor_take: string | null;
  advisor_take_updated_by_id: string | null;
  advisor_take_updated_at: string | null;
  kb_tier: KbTier;
  provenance: KbProvenance;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  verified_by_id: string | null;
  verified_at: string | null;
  region_id: string | null;
  country_id: string | null;
  city_id: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  latitude: number | null;
  longitude: number | null;
  website_url: string | null;
  destination_profile_id: string | null;
  /** Optional Rate Layer hotel (properties.id). Empty is allowed. */
  property_id: string | null;
  contract_status: KbContractStatus;
  client_ready: boolean;
  placeholder: boolean;
  not_yet_open: boolean;
  external_ids: Record<string, unknown>;
  legacy_notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Guide proposed tier on kb_hotel_details.luxury_band (037). Same as HotelPriceTier. */
export type KbHotelPriceTier = "Tier 1" | "Tier 2" | "Tier 3";

/** Row from public.kb_hotel_details (1:1 hotel entity). */
export type KbHotelDetails = {
  entity_id: string;
  amenities: string[];
  dining_notes: string | null;
  wellness_notes: string | null;
  /** Style labels for similar-hotel matching (021). */
  style_tags: string[];
  /** Proposed guide tier: Tier 1 / Tier 2 / Tier 3 (037; was ultra_luxury/luxury/premium). */
  luxury_band: KbHotelPriceTier | null;
  /** Neighbourhood / guide area (037). */
  guide_area: string | null;
  /** Partner program / status prose (037). */
  guide_partner: string | null;
  /** Internal guide average score (~1–5); never show as guest stars (037). */
  guide_score: number | null;
  /**
   * Internal guide matrix factors (038). Full-name keys, values 1–5;
   * omit unscored (?). Not guest feedback.
   */
  guide_score_factors: KbHotelGuideScoreFactors;
  /** Who the hotel suits (Atlas Wave 1). */
  best_for: string[];
  /** Who it is a weaker fit for (Atlas Wave 1). */
  not_ideal_for: string[];
  created_at: string;
  updated_at: string;
};

/** Frozen keys for kb_hotel_details.guide_score_factors (038). */
export type KbHotelGuideScoreFactorKey =
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
  | "consistency";

/** Canonical factor key list (seed / TB / Excel). */
export const KB_HOTEL_GUIDE_SCORE_FACTOR_KEYS: readonly KbHotelGuideScoreFactorKey[] =
  [
    "luxury",
    "support",
    "rooms",
    "food_and_beverage",
    "neighbourhood",
    "access",
    "service",
    "character",
    "wellness",
    "family",
    "indian_client_fit",
    "value",
    "views_and_privacy",
    "consistency",
  ] as const;

/** Sparse map — missing key means not scored (?). */
export type KbHotelGuideScoreFactors = Partial<
  Record<KbHotelGuideScoreFactorKey, number>
>;

/** Row from public.kb_hotel_room_categories (1:N). No rates. */
export type KbHotelRoomCategory = {
  id: string;
  entity_id: string;
  name: string;
  room_size: string | null;
  bed_type: string | null;
  room_view: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_hotel_consortia (1:N). */
export type KbHotelConsortia = {
  id: string;
  entity_id: string;
  club_key: string;
  club_name: string;
  negotiated_rate_code_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_restaurant_details (1:1). price_tier is a label only. */
export type KbRestaurantDetails = {
  entity_id: string;
  cuisine: string | null;
  price_tier: string | null;
  awards: unknown[];
  /** Guide Who it suits (036). */
  who_it_suits: string | null;
  /** Booking lead time (036). */
  lead_time: string | null;
  /** Vegetarian / Jain notes (036). */
  veg_jain_notes: string | null;
  /** Guide Type: Restaurant / Bar (036). */
  guide_type: string | null;
  /** Optional provenance (036). */
  seen_in: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_activity_details (1:1). */
export type KbActivityDetails = {
  entity_id: string;
  category: string | null;
  operator_name: string | null;
  vendor_entity_id: string | null;
  /** Real duration only — not booking lead time. */
  duration_text: string | null;
  price_tier: string | null;
  /** Guide Who it suits (036). */
  who_it_suits: string | null;
  /** Booking lead time (036). */
  lead_time: string | null;
  /** Vegetarian / Jain notes (036). */
  veg_jain_notes: string | null;
  /** Guide Type: Experience / Activity (036). */
  guide_type: string | null;
  /** Optional provenance (036). */
  seen_in: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_vendor_details (1:1). Staff contacts — not client by default. */
export type KbVendorDetails = {
  entity_id: string;
  vendor_type: KbVendorType;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_facts. Chat uses status=approved only. */
export type KbFact = {
  id: string;
  entity_id: string;
  source_id: string | null;
  title: string | null;
  body: string;
  kb_tier: KbTier;
  provenance: KbProvenance;
  status: KbFactStatus;
  metadata: Record<string, unknown>;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_fact_chunks. Embedding null until KB-R2. */
export type KbFactChunk = {
  id: string;
  fact_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding: number[] | null;
  embedding_model: string | null;
  token_count: number | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_internal_notes. Never client-facing. */
export type KbInternalNote = {
  id: string;
  entity_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
};

/** Row from public.kb_customer_feedback. Anonymous; jobs never set used_in_advisor_take. */
export type KbCustomerFeedback = {
  id: string;
  entity_id: string;
  trip_id: string | null;
  rating: number | null;
  comments: string | null;
  category_tags: string[];
  advisor_reviewed: boolean;
  used_in_advisor_take: boolean;
  created_at: string;
};

/** Row from public.kb_itineraries (template — not a live trip). */
export type KbItinerary = {
  id: string;
  title: string;
  /** Route line (nights per place) + optional PureLuxe pace note. */
  destination_summary: string | null;
  country_id: string | null;
  /** Guide Length (nights). */
  duration_nights: number | null;
  /** Who this shape suits. */
  suits: string | null;
  sort_order: number;
  /** Prefer on Where / first-trip when set. */
  is_default_first_trip: boolean;
  /** Sakura / autumn / summer / family / honeymoon modifiers. */
  seasonal_notes: string | null;
  kb_tier: KbTier;
  provenance: KbProvenance;
  client_ready: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_itinerary_items. */
export type KbItineraryItem = {
  id: string;
  itinerary_id: string;
  day_number: number;
  sort_order: number;
  entity_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_scrape_jobs. */
export type KbScrapeJob = {
  id: string;
  source_id: string;
  /** Cron: `0 5 * * *` or `* * * * * *`. Null = not on a timer. */
  cron_expression: string | null;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_scrape_runs. */
export type KbScrapeRun = {
  id: string;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  status: KbScrapeRunStatus;
  pages_fetched: number;
  entities_saved: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
};
