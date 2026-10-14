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

/** Offline contracted agreement type (PDF digitization). */
export type PropertyContractType = "wholesale" | "package" | "tactical";

/** Season label used on Maldives/India-style contracts. */
export type PropertyRateSeasonCode =
  | "peak"
  | "high"
  | "low"
  | "shoulder"
  | "other";

/** How a contracted rate row is priced. */
export type PropertyRateBasis = "nightly" | "package";

export type PropertyRateAddonType =
  | "transfer"
  | "green_tax"
  | "meal"
  | "beverage"
  | "festive"
  | "extra_adult"
  | "extra_child"
  | "other";

export type PropertyRateAddonUnit =
  | "per_person"
  | "per_person_per_night"
  | "per_night"
  | "per_villa_per_night"
  | "per_event"
  | "per_stay";

export type PropertyContractOfferType =
  | "percent_off_villa"
  | "free_board_upgrade"
  | "transfer_discount"
  | "family"
  | "bundle"
  | "other";

/** Row from public.properties (thin hotel master — shared by all rate sources). */
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
  default_currency: string;
  min_markup_percent: number | null;
  contracting_entity_name: string | null;
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

/**
 * Flexible offline-contract policy blob on property_contracts.policies.
 * Shape varies by hotel PDF; keep money in rates/addons/offers tables.
 */
export type PropertyContractPolicies = {
  stay_rules?: unknown[];
  payment_rules?: unknown[];
  transfer_policies?: unknown[];
  legal?: Record<string, unknown>;
  [key: string]: unknown;
};

/** One honeymoon / anniversary / value-add entitlement in property_contracts.benefits. */
export type PropertyContractBenefit = {
  type?: string;
  min_nights?: number;
  requires?: string;
  items?: string[];
  combinable_with_offers?: boolean;
  [key: string]: unknown;
};

/** Supplier payout / bank details on property_contracts.payout. */
export type PropertyContractPayout = {
  account_name?: string;
  bank_name?: string;
  account_number?: string;
  swift?: string;
  currency?: string;
  correspondent_bank?: string;
  correspondent_swift?: string;
  [key: string]: unknown;
};

/** Row from public.property_contracts (offline_contracted PDF/agreement header). */
export type PropertyContract = {
  id: string;
  property_id: string;
  name: string;
  contract_type: PropertyContractType;
  market: string | null;
  valid_from: string | null;
  valid_to: string | null;
  currency: string;
  booking_code: string | null;
  min_markup_percent: number | null;
  source_document_name: string | null;
  policies: PropertyContractPolicies;
  benefits: PropertyContractBenefit[];
  payout: PropertyContractPayout;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Row from public.property_contracted_rates.
 * Maps to NormalizedRateOption for offline_contracted the same way Sabre/wholesale/paste do:
 * room_category → room_name, cost_amount(+unit math) → cost_internal, board/inclusions shared.
 */
export type PropertyContractedRate = {
  id: string;
  property_id: string;
  contract_id: string | null;
  room_category: string | null;
  season_code: PropertyRateSeasonCode | null;
  rate_basis: PropertyRateBasis;
  valid_from: string | null;
  valid_to: string | null;
  currency: string;
  cost_amount: number;
  cost_unit: "per_stay" | "per_night" | "per_person" | "package";
  package_nights: number | null;
  extra_night_amount: number | null;
  base_adults: number;
  base_children: number;
  max_adults: number | null;
  max_children: number | null;
  board: string | null;
  includes_breakfast: boolean;
  includes_lunch: boolean;
  includes_dinner: boolean;
  includes_transfer: boolean;
  includes_green_tax: boolean;
  min_nights: number | null;
  units_count: number | null;
  sort_order: number;
  inclusions: unknown[];
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.property_rate_addons. */
export type PropertyRateAddon = {
  id: string;
  property_id: string;
  contract_id: string | null;
  addon_type: PropertyRateAddonType;
  name: string;
  amount: number;
  currency: string;
  unit: PropertyRateAddonUnit;
  age_from: number | null;
  age_to: number | null;
  valid_from: string | null;
  valid_to: string | null;
  board_required: string | null;
  mandatory: boolean;
  applies_to_room_categories: unknown[];
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

/** Row from public.property_contract_offers. */
export type PropertyContractOffer = {
  id: string;
  property_id: string;
  contract_id: string | null;
  name: string;
  offer_type: PropertyContractOfferType;
  percent_off_villa: number | null;
  free_board: string | null;
  transfer_discount_percent: number | null;
  valid_from: string | null;
  valid_to: string | null;
  book_by: string | null;
  min_nights: number | null;
  blackout_dates: unknown[];
  excluded_room_categories: unknown[];
  combinable_flags: Record<string, unknown>;
  notes: string | null;
  active: boolean;
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
