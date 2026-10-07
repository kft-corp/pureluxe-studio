import type { TripFacts } from "@pureluxe/ai";

import type { TripDetail, TripRateSnapshot } from "@/lib/trip-builder";

function toRateFact(rate: TripRateSnapshot) {
  return {
    title: rate.title,
    subtitle: rate.subtitle,
    cost_internal: rate.cost_internal,
    currency: rate.currency,
    rate_source_code: rate.rate_source_code,
    selected: rate.selected,
  };
}

/** Map Studio trip aggregate → lean AI trip facts. */
export function toTripFacts(detail: TripDetail): TripFacts {
  const selected = detail.rates.selected;

  return {
    trip_id: detail.trip.id,
    title: detail.trip.title,
    status: detail.trip.status,
    pricing_locked: detail.pricing_locked,
    client: detail.client
      ? { id: detail.client.id, display_name: detail.client.display_name }
      : null,
    stay: detail.stay
      ? {
          city: detail.stay.city,
          check_in: detail.stay.check_in,
          check_out: detail.stay.check_out,
          property_name: detail.stay.property_name,
        }
      : null,
    rates: {
      selected: selected ? toRateFact(selected) : null,
      candidates: detail.rates.candidates.map(toRateFact),
    },
    quote: {
      title: detail.quote.title,
      intro: detail.quote.intro,
      notes: detail.quote.notes,
      highlights: detail.quote.highlights,
      sell_total: detail.quote.sell_total,
      sell_currency: detail.quote.sell_currency,
      document_status: detail.quote.document?.status ?? null,
      has_file: detail.quote.document?.has_file ?? false,
    },
  };
}
