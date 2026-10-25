import type { TripFacts } from "@pureluxe/ai";

import { buildQuoteBreakup } from "@/components/trip-builder/quote-price";
import { resolveNextStep, resolveTripStage, tripStays } from "@/components/trip-builder/stages";
import type { TripDetail, TripRateSnapshot } from "@/lib/trip-builder";

function toRateFact(rate: TripRateSnapshot) {
  return {
    title: rate.title,
    subtitle: rate.subtitle,
    cost_internal: rate.cost_internal,
    currency: rate.currency,
    rate_source_code: rate.rate_source_code,
    selected: rate.selected,
    sell_amount: rate.sell_amount,
    inclusions: rate.inclusions,
    cancellation_policy: rate.cancellation_policy,
    payment_policy: rate.payment_policy,
  };
}

function stayFact(
  stay: TripDetail["stays"][number],
  rates: TripDetail["rates"],
) {
  return {
    city: stay.city,
    check_in: stay.check_in,
    check_out: stay.check_out,
    property_name: stay.property_name,
    rate_selected: rates.candidates.some(
      (rate) => rate.selected && rate.leg_id === stay.leg_id,
    ),
  };
}

/** Map Studio trip aggregate → lean AI trip facts. */
export function toTripFacts(detail: TripDetail, readiness?: string[]): TripFacts {
  const selected = detail.rates.selected;
  const price = buildQuoteBreakup({
    stays: tripStays(detail),
    rates: detail.rates.candidates,
    sellTotal: detail.quote.sell_total,
    sellCurrency: detail.quote.sell_currency,
  });
  const stays = (detail.stays.length > 0
    ? detail.stays
    : detail.stay
      ? [detail.stay]
      : []
  ).map((stay) => stayFact(stay, detail.rates));
  const open =
    stays.find((stay) => !stay.property_name || !stay.rate_selected) ??
    stays[0] ??
    null;

  return {
    trip_id: detail.trip.id,
    version: detail.trip.version,
    title: detail.trip.title,
    status: detail.trip.status,
    pricing_locked: detail.pricing_locked,
    assumptions: Object.entries(detail.trip.assumptions ?? {})
      .filter(([, assumed]) => assumed)
      .map(([key]) => key),
    stage: resolveTripStage(detail),
    next_step: resolveNextStep(detail),
    client: detail.client
      ? { id: detail.client.id, display_name: detail.client.display_name }
      : null,
    travellers_confirmed: Boolean(detail.trip.travellers_confirmed_at),
    travellers: detail.travellers.map((person) => ({
      client_id: person.client_id,
      display_name: person.display_name,
      role: person.role,
      party_role: person.party_role,
    })),
    family_suggestions: detail.family_suggestions.map((person) => ({
      client_id: person.client_id,
      display_name: person.display_name,
      party_role: person.party_role,
      family_role: person.family_role,
    })),
    starts_on: detail.trip.starts_on,
    ends_on: detail.trip.ends_on,
    legs_confirmed: Boolean(detail.trip.legs_confirmed_at),
    stay: open
      ? {
          city: open.city,
          check_in: open.check_in,
          check_out: open.check_out,
          property_name: open.property_name,
        }
      : null,
    stays,
    rates: {
      selected: selected ? toRateFact(selected) : null,
      candidates: detail.rates.candidates.map(toRateFact),
    },
    quote: {
      title: detail.options_quote.title,
      notes: detail.options_quote.notes,
      sell_total: detail.quote.sell_total,
      sell_currency: detail.quote.sell_currency,
      document_status: detail.options_quote.document?.status ?? null,
      has_file: detail.options_quote.document?.has_file ?? false,
      line_edit_count: Object.keys(detail.options_quote.line_edits ?? {}).length,
    },
    price: {
      hotel_net: price.hotelNet,
      tax: price.tax,
      margin: price.margin,
      margin_percent: price.marginPercent,
      client_price: price.clientPrice,
      note: price.pricedLabel ?? price.note,
    },
    readiness,
  };
}
