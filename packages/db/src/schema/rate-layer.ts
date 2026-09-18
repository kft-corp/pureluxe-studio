/** Row from public.company_settings. */
export type CompanySetting = {
  key: string;
  value: Record<string, unknown>;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Seeded shape for company_settings.key = rate_sources. */
export type RateSourceChannelFlag = {
  enabled: boolean;
};

export type RateSourcesSetting = {
  default_currency: string;
  allow_offline_paste: boolean;
  gds_undercut_pct: number;
  gds_compare_mode: "cheaper_of_public_or_negotiated";
  always_surface_negotiated_gds: boolean;
  offline_availability_check: boolean;
  sources: {
    gds_public: RateSourceChannelFlag;
    gds_negotiated: RateSourceChannelFlag;
    ota_bedbank: RateSourceChannelFlag;
    wholesale: RateSourceChannelFlag;
    offline_contracted: RateSourceChannelFlag;
    offline_manual: RateSourceChannelFlag;
  };
};

/** Seeded shape for company_settings.key = knowledge_base. */
export type KnowledgeBaseSetting = {
  scrape_enabled: boolean;
  fallback_llm_enabled: boolean;
  guest_review_factcheck_enabled: boolean;
};

export type DestinationType =
  | "city_countryside"
  | "resort_beach"
  | "ski"
  | "safari_yacht_special"
  | "untyped";

export type DestinationRoutingPattern =
  | "gds_first"
  | "wholesale_first"
  | "parallel_lowest"
  | "offline_only"
  | "gds_then_offline_at_peak"
  | "custom";

export type Layer2Pattern = "wholesale_first" | "parallel_lowest" | "custom";

export type RateSourceCode =
  | "gds_public"
  | "gds_negotiated"
  | "ota_bedbank"
  | "wholesale"
  | "offline_contracted"
  | "offline_manual";

export type KbProvenance = "verified" | "scraped" | "fallback";
export type KbFactStatus = "draft" | "approved" | "archived";
export type KbEntityType =
  | "property"
  | "destination"
  | "dining"
  | "experience"
  | "other";

/** Row from public.destination_type_defaults. */
export type DestinationTypeDefault = {
  destination_type: DestinationType;
  pattern: DestinationRoutingPattern;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.destination_profiles. */
export type DestinationProfile = {
  id: string;
  canonical_name: string;
  aliases: string[];
  destination_type: DestinationType;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.destination_routing_overrides. */
export type DestinationRoutingOverride = {
  id: string;
  destination_profile_id: string;
  pattern: Layer2Pattern;
  custom_source_order: string[] | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.destination_wholesalers. */
export type DestinationWholesaler = {
  id: string;
  destination_profile_id: string;
  wholesaler_name: string;
  supplier_key: string;
  priority: number;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.rate_peak_windows. */
export type RatePeakWindow = {
  id: string;
  destination_profile_id: string | null;
  destination_type: DestinationType | null;
  name: string;
  start_date: string;
  end_date: string;
  behaviour: "offline_if_zero_gds";
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.negotiated_rate_codes. */
export type NegotiatedRateCode = {
  id: string;
  code: string;
  label: string;
  supplier_key: string;
  chains: unknown[];
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.properties (thin hotel master). */
export type Property = {
  id: string;
  name: string;
  destination: string | null;
  brand: string | null;
  chain: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
  property_type: string | null;
  destination_profile_id: string | null;
  curated_hotel_id: string | null;
  default_commission: number | null;
  commission_channel: string | null;
  commissionable: boolean | null;
  relationship_strength: string | null;
  booking_notes: string | null;
  vip_contact_notes: string | null;
  reservations_email: string | null;
  general_phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.property_supplier_codes. */
export type PropertySupplierCode = {
  id: string;
  property_id: string;
  supplier_key: string;
  supplier_property_code: string;
  meta: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.property_contracted_rates. */
export type PropertyContractedRate = {
  id: string;
  property_id: string;
  valid_from: string | null;
  valid_to: string | null;
  currency: string;
  cost_amount: number;
  cost_unit: "per_stay" | "per_night" | "per_person" | "package";
  board: string | null;
  inclusions: unknown[];
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_sources. */
export type KbSource = {
  id: string;
  name: string;
  source_kind:
    | "website"
    | "drive_doc"
    | "advisor_note"
    | "hotel_intake"
    | "consortia_portal"
    | "tourism_board"
    | "other";
  base_url: string | null;
  scrape_method: string | null;
  tos_notes: string | null;
  meta: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_entities. */
export type KbEntity = {
  id: string;
  entity_type: KbEntityType;
  name: string;
  destination_profile_id: string | null;
  linked_property_id: string | null;
  external_keys: Record<string, unknown>;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_facts. */
export type KbFact = {
  id: string;
  entity_id: string;
  source_id: string | null;
  title: string | null;
  body: string;
  provenance: KbProvenance;
  status: KbFactStatus;
  meta: Record<string, unknown>;
  updated_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.kb_fact_chunks (semantic RAG search target). */
export type KbFactChunk = {
  id: string;
  fact_id: string;
  chunk_index: number;
  chunk_text: string;
  /** Null until embedded for KB-R2. */
  embedding: number[] | null;
  embedding_model: string | null;
  token_count: number | null;
  created_at: string;
  updated_at: string;
};

/** Row from public.rate_search_events. */
export type RateSearchEvent = {
  id: string;
  trip_id: string | null;
  leg_id: string | null;
  property_id: string | null;
  requested_by_id: string | null;
  destination_text: string | null;
  routing_layer: number | null;
  pattern: string | null;
  sources_tried: unknown[];
  outcome: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};
