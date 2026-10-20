import type { Trip } from "@pureluxe/db";

import type { TripDetail, TripRateSnapshot, TripStaySnapshot } from "@/lib/trip-builder";

export function makeStay(
  partial: Partial<TripStaySnapshot> & { leg_id: string; city: string },
): TripStaySnapshot {
  return {
    check_in: null,
    check_out: null,
    property_id: null,
    property_name: null,
    destination_profile_id: null,
    adults: null,
    children: null,
    rooms: null,
    ...partial,
  };
}

export function makeTrip(partial: Partial<Trip> = {}): Trip {
  return {
    id: "trip-1",
    primary_client_id: null,
    relationship_owner_id: null,
    title: null,
    starts_on: null,
    ends_on: null,
    legs_confirmed_at: null,
    travellers_confirmed_at: null,
    status: "building",
    client_visibility: "draft",
    published_at: null,
    published_by_id: null,
    sell_total: null,
    sell_currency: null,
    cost_total_internal: null,
    margin_internal: null,
    payment_plan: null,
    pricing_locked_at: null,
    pricing_locked_by_id: null,
    source: "studio",
    created_by_id: null,
    is_demo: false,
    archived_at: null,
    archived_by_id: null,
    last_studio_message_at: null,
    last_studio_message_preview: null,
    version: 1,
    assumptions: {},
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    ...partial,
  };
}

export function makeTripDetail(
  overrides: Partial<Omit<TripDetail, "trip">> & { trip?: Partial<Trip> } = {},
): TripDetail {
  const { trip, ...rest } = overrides;
  return {
    trip: makeTrip(trip),
    client: null,
    travellers: [],
    family_suggestions: [],
    stay: null,
    stays: [],
    rates: { selected: null, candidates: [] },
    quote: {
      title: null,
      intro: null,
      notes: null,
      highlights: [],
      sell_total: null,
      sell_currency: null,
      payment_plan: null,
      document: null,
    },
    options_quote: { title: null, notes: null, line_edits: {}, document: null },
    pricing_locked: false,
    ...rest,
  };
}

export function makeRate(
  partial: Partial<TripRateSnapshot> & { id: string; leg_id: string; title: string },
): TripRateSnapshot {
  return {
    subtitle: null,
    property_name: null,
    currency: null,
    sell_amount: null,
    cost_internal: null,
    tax_percentage: null,
    rate_source_code: null,
    cancellation_policy: null,
    payment_policy: null,
    season_code: null,
    property_id: null,
    contract_id: null,
    rate_note: null,
    inclusions: [],
    status: "pending",
    selected: false,
    ...partial,
  };
}
