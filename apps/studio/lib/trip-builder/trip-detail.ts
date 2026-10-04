import {
  findClientById,
  findFirstTripLeg,
  findSelectedAccommodationLineItem,
  findStayShellLineItem,
  findTripDocument,
  listPricedAccommodationLineItems,
  type Trip,
  type TripDocument,
  type TripLeg,
  type TripLineItem,
} from "@pureluxe/db";

export type TripStaySnapshot = {
  leg_id: string;
  city: string;
  check_in: string | null;
  check_out: string | null;
  property_id: string | null;
  property_name: string | null;
  destination_profile_id: string | null;
};

export type TripClientSnapshot = {
  id: string;
  display_name: string;
};

export type TripRateSnapshot = {
  id: string;
  leg_id: string | null;
  title: string;
  subtitle: string | null;
  property_name: string | null;
  currency: string | null;
  cost_internal: number | null;
  rate_source_code: string | null;
  status: TripLineItem["status"];
  selected: boolean;
};

export type TripRatesSnapshot = {
  selected: TripRateSnapshot | null;
  candidates: TripRateSnapshot[];
};

export type TripQuoteDocumentSnapshot = {
  id: string;
  type: string;
  status: string;
  generated_at: string | null;
  has_file: boolean;
  source_fingerprint: string | null;
};

export type TripQuoteSnapshot = {
  title: string | null;
  intro: string | null;
  notes: string | null;
  highlights: string[];
  sell_total: number | null;
  sell_currency: string | null;
  payment_plan: Record<string, unknown> | null;
  document: TripQuoteDocumentSnapshot | null;
};

export type TripDetail = {
  trip: Trip;
  client: TripClientSnapshot | null;
  stay: TripStaySnapshot | null;
  rates: TripRatesSnapshot;
  quote: TripQuoteSnapshot;
  pricing_locked: boolean;
};

export type QuoteNarrative = {
  title: string | null;
  intro: string | null;
  notes: string | null;
  highlights: string[];
};

function stayFromLegAndHotel(
  leg: TripLeg,
  hotel: { property_id: string | null; property_name: string | null } | null,
): TripStaySnapshot {
  return {
    leg_id: leg.id,
    city: leg.destination,
    check_in: leg.check_in,
    check_out: leg.check_out,
    property_id: hotel?.property_id ?? null,
    property_name: hotel?.property_name ?? null,
    destination_profile_id: leg.destination_profile_id,
  };
}

function toRateSnapshot(row: TripLineItem): TripRateSnapshot {
  return {
    id: row.id,
    leg_id: row.leg_id,
    title: row.title,
    subtitle: row.subtitle,
    property_name: row.property_name,
    currency: row.currency,
    cost_internal: row.cost_internal,
    rate_source_code: row.rate_source_code,
    status: row.status,
    selected: row.selected,
  };
}

/** Parse presentation overlay from trip_documents.narrative_json. */
export function parseQuoteNarrative(
  value: Record<string, unknown> | null | undefined,
): QuoteNarrative {
  if (!value) {
    return { title: null, intro: null, notes: null, highlights: [] };
  }
  return {
    title: typeof value.title === "string" ? value.title : null,
    intro: typeof value.intro === "string" ? value.intro : null,
    notes: typeof value.notes === "string" ? value.notes : null,
    highlights: Array.isArray(value.highlights)
      ? value.highlights.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function toQuoteSnapshot(
  trip: Trip,
  document: TripDocument | null,
): TripQuoteSnapshot {
  const narrative = parseQuoteNarrative(document?.narrative_json);
  return {
    title: narrative.title ?? trip.title,
    intro: narrative.intro,
    notes: narrative.notes,
    highlights: narrative.highlights,
    sell_total: trip.sell_total,
    sell_currency: trip.sell_currency,
    payment_plan:
      trip.payment_plan &&
      typeof trip.payment_plan === "object" &&
      !Array.isArray(trip.payment_plan)
        ? trip.payment_plan
        : null,
    document: document
      ? {
          id: document.id,
          type: document.type,
          status: document.status,
          generated_at: document.generated_at,
          has_file: Boolean(document.file_path),
          source_fingerprint: document.source_fingerprint,
        }
      : null,
  };
}

/** Resolve Phase 1 stay: first leg + selected hotel or stay shell. */
export async function loadTripStay(
  tripId: string,
): Promise<TripStaySnapshot | null> {
  const leg = await findFirstTripLeg(tripId);
  if (!leg) return null;

  const [selected, shell] = await Promise.all([
    findSelectedAccommodationLineItem(tripId, leg.id),
    findStayShellLineItem(tripId, leg.id),
  ]);
  return stayFromLegAndHotel(leg, selected ?? shell);
}

async function loadTripRates(tripId: string): Promise<TripRatesSnapshot> {
  const candidates = await listPricedAccommodationLineItems(tripId).then(
    (rows) => rows.map(toRateSnapshot),
  );
  return {
    selected: candidates.find((row) => row.selected) ?? null,
    candidates,
  };
}

/** Studio aggregate for Trip Builder open-trip. */
export async function buildTripDetail(trip: Trip): Promise<TripDetail> {
  const [clientRow, stay, rates, document] = await Promise.all([
    trip.primary_client_id
      ? findClientById(trip.primary_client_id)
      : Promise.resolve(null),
    loadTripStay(trip.id),
    loadTripRates(trip.id),
    findTripDocument(trip.id, "rates"),
  ]);

  return {
    trip,
    client: clientRow
      ? { id: clientRow.id, display_name: clientRow.display_name }
      : null,
    stay,
    rates,
    quote: toQuoteSnapshot(trip, document),
    pricing_locked: Boolean(trip.pricing_locked_at),
  };
}
