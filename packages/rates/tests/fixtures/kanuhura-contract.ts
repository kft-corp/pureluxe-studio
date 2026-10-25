/**
 * Seeded-style Six Senses Kanuhura wholesale figures for Stage 3b unit tests.
 * Mirrors supabase/migrations/seeds/011_rate_layer_kanuhura.sql (simplified).
 */
import type {
  PropertyContract,
  PropertyContractOffer,
  PropertyContractedRate,
  PropertyRateAddon,
} from "@pureluxe/db";

const CONTRACT_ID = "contract-wholesale";
const PROPERTY_ID = "prop-kanuhura";
const INDIA_CONTRACT_ID = "contract-india";

function rate(
  partial: Partial<PropertyContractedRate> &
    Pick<PropertyContractedRate, "id" | "room_category" | "season_code" | "valid_from" | "valid_to" | "cost_amount">,
): PropertyContractedRate {
  return {
    property_id: PROPERTY_ID,
    contract_id: CONTRACT_ID,
    rate_basis: "nightly",
    currency: "USD",
    cost_unit: "per_night",
    package_nights: null,
    extra_night_amount: null,
    base_adults: 2,
    base_children: 0,
    max_adults: 2,
    max_children: 0,
    board: "BB",
    includes_breakfast: true,
    includes_lunch: false,
    includes_dinner: false,
    includes_transfer: false,
    includes_green_tax: false,
    min_nights: 1,
    units_count: 6,
    sort_order: 10,
    inclusions: ["breakfast"],
    notes: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function addon(
  partial: Partial<PropertyRateAddon> &
    Pick<PropertyRateAddon, "id" | "addon_type" | "name" | "amount" | "unit">,
): PropertyRateAddon {
  return {
    property_id: PROPERTY_ID,
    contract_id: CONTRACT_ID,
    currency: "USD",
    age_from: null,
    age_to: null,
    valid_from: "2026-12-22",
    valid_to: "2027-12-21",
    board_required: null,
    mandatory: false,
    applies_to_room_categories: ["*"],
    notes: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

function offer(
  partial: Partial<PropertyContractOffer> &
    Pick<PropertyContractOffer, "id" | "name" | "offer_type">,
): PropertyContractOffer {
  return {
    property_id: PROPERTY_ID,
    contract_id: CONTRACT_ID,
    percent_off_villa: null,
    free_board: null,
    transfer_discount_percent: null,
    valid_from: "2027-01-07",
    valid_to: "2027-04-11",
    book_by: null,
    min_nights: 3,
    blackout_dates: [],
    excluded_room_categories: [],
    combinable_flags: {},
    notes: null,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

/** Beach Villa — 2 adults max, no children (occupancy filter cases). */
export const beachVillaHigh = rate({
  id: "rate-beach-high",
  room_category: "Beach Villa",
  season_code: "high",
  valid_from: "2027-01-07",
  valid_to: "2027-04-11",
  cost_amount: 1470,
  max_adults: 2,
  max_children: 0,
  sort_order: 10,
});

export const beachVillaPeak = rate({
  id: "rate-beach-peak",
  room_category: "Beach Villa",
  season_code: "peak",
  valid_from: "2026-12-22",
  valid_to: "2027-01-06",
  cost_amount: 2450,
  max_adults: 2,
  max_children: 0,
  min_nights: 5,
  sort_order: 10,
});

/** Beach Villa with Pool — fits 1 child per room (party / 2-room cases). */
export const beachPoolHigh = rate({
  id: "rate-beach-pool-high",
  room_category: "Beach Villa with Pool",
  season_code: "high",
  valid_from: "2027-01-07",
  valid_to: "2027-04-11",
  cost_amount: 1690,
  max_adults: 3,
  max_children: 1,
  sort_order: 20,
});

export const beachPoolPeak = rate({
  id: "rate-beach-pool-peak",
  room_category: "Beach Villa with Pool",
  season_code: "peak",
  valid_from: "2026-12-22",
  valid_to: "2027-01-06",
  cost_amount: 2700,
  max_adults: 3,
  max_children: 1,
  min_nights: 5,
  sort_order: 20,
});

/** India-only package rate (market filter). */
export const indiaBeachHigh = rate({
  id: "rate-india-beach-high",
  contract_id: INDIA_CONTRACT_ID,
  room_category: "Beach Villa",
  season_code: "high",
  valid_from: "2027-01-07",
  valid_to: "2027-04-11",
  cost_amount: 1200,
  rate_basis: "package",
  cost_unit: "package",
  package_nights: 5,
  max_adults: 2,
  max_children: 0,
});

export const wholesaleContract: PropertyContract = {
  id: CONTRACT_ID,
  property_id: PROPERTY_ID,
  name: "Wholesale Rates Agreement 2026-2027",
  contract_type: "wholesale",
  market: null,
  market_codes: [],
  valid_from: "2026-12-22",
  valid_to: "2027-12-21",
  currency: "USD",
  booking_code: null,
  min_markup_percent: 25,
  source_document_name: "Wholesale Rates Agreement 2026-2027.pdf",
  policies: {},
  benefits: [],
  payout: {},
  taxes_included: false,
  service_charge_pct: 10,
  tax_pct: 17,
  tax_on_service_charge: true,
  notes: null,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

export const indiaContract: PropertyContract = {
  ...wholesaleContract,
  id: INDIA_CONTRACT_ID,
  name: "India package 2026",
  market: "india",
  market_codes: ["IN"],
  booking_code: "SSK26IN",
  service_charge_pct: null,
  tax_pct: null,
};

export const greenTax = addon({
  id: "addon-green-tax",
  addon_type: "green_tax",
  name: "Green Tax",
  amount: 12,
  unit: "per_person_per_night",
  age_from: 2,
  mandatory: true,
});

export const extraAdultBb = addon({
  id: "addon-extra-adult",
  addon_type: "extra_adult",
  name: "Extra adult BB",
  amount: 285,
  unit: "per_person_per_night",
  age_from: 12,
  board_required: "BB",
});

export const extraChildYoung = addon({
  id: "addon-extra-child-young",
  addon_type: "extra_child",
  name: "Extra child 2-11",
  amount: 100,
  unit: "per_person_per_night",
  age_from: 2,
  age_to: 11,
});

export const extraChildTeen = addon({
  id: "addon-extra-child-teen",
  addon_type: "extra_child",
  name: "Extra child 12-17",
  amount: 200,
  unit: "per_person_per_night",
  age_from: 12,
  age_to: 17,
});

export const highSeasonOffer = offer({
  id: "offer-high-25",
  name: "High 25% off villa",
  offer_type: "percent_off_villa",
  percent_off_villa: 25,
  valid_from: "2027-01-07",
  valid_to: "2027-04-11",
  min_nights: 3,
});

export const wholesaleAddons = [greenTax, extraAdultBb, extraChildYoung, extraChildTeen];
export const wholesaleOffers = [highSeasonOffer];

export const highSeasonRates = [beachVillaHigh, beachPoolHigh];
export const crossSeasonRates = [beachVillaPeak, beachVillaHigh, beachPoolPeak, beachPoolHigh];

export { CONTRACT_ID, PROPERTY_ID, INDIA_CONTRACT_ID };
