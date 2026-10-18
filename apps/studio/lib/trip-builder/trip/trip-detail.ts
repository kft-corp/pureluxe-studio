import {
  findClientById,
  findClientFamily,
  findPrimaryTripClient,
  listTripLegs,
  listTripTravellers,
  findSelectedAccommodationLineItem,
  findStayShellLineItem,
  findTripDocument,
  listPricedAccommodationLineItems,
  updateTrip as dbUpdateTrip,
  type Trip,
  type TripDocument,
  type TripLeg,
  type TripLineItem,
} from "@pureluxe/db";

import { nextTripTitle } from "./trip-title";

export type TripStaySnapshot = {
  leg_id: string;
  city: string;
  check_in: string | null;
  check_out: string | null;
  property_id: string | null;
  property_name: string | null;
  destination_profile_id: string | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
};

export type TripClientSnapshot = {
  id: string;
  display_name: string;
};

export type TripTravellerSnapshot = {
  client_id: string;
  display_name: string;
  role: "primary" | "companion";
  party_role: "adult" | "child";
  family_role: string | null;
};

export type TripFamilySuggestion = {
  client_id: string;
  display_name: string;
  party_role: "adult" | "child";
  family_role: string;
};

export type TripRateSnapshot = {
  id: string;
  leg_id: string | null;
  title: string;
  subtitle: string | null;
  property_name: string | null;
  currency: string | null;
  /** Price offered to the client for this room. Advisor cost stays in cost_internal. */
  sell_amount: number | null;
  cost_internal: number | null;
  /** Percent points, for example 18 for 18%. Null when tax was not stored. */
  tax_percentage: number | null;
  rate_source_code: string | null;
  cancellation_policy: string | null;
  /** Payment line stored with the rate. The options PDF keeps only the stay's season. */
  payment_policy: string | null;
  /** Season on the contracted row, such as shoulder. Null when the rate has none. */
  season_code: string | null;
  property_id: string | null;
  /** Contract on the saved rate, when the row stored one. */
  contract_id: string | null;
  /** Supplier note stored on the rate. The options PDF keeps only a client-facing line. */
  rate_note: string | null;
  inclusions: string[];
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

/** Rooms shared with the client before one room is chosen. */
export type TripOptionsQuoteSnapshot = {
  title: string | null;
  notes: string | null;
  /** Advisor wording layered on the printed lines. Header and footer are not here. */
  line_edits: Record<string, string>;
  document: TripQuoteDocumentSnapshot | null;
};

export type TripDetail = {
  trip: Trip;
  client: TripClientSnapshot | null;
  travellers: TripTravellerSnapshot[];
  /** Household members of the lead who are not on the trip yet. */
  family_suggestions: TripFamilySuggestion[];
  /** First stay. Prefer `stays` when a trip has more than one. */
  stay: TripStaySnapshot | null;
  stays: TripStaySnapshot[];
  rates: TripRatesSnapshot;
  quote: TripQuoteSnapshot;
  options_quote: TripOptionsQuoteSnapshot;
  pricing_locked: boolean;
};

export type QuoteNarrative = {
  title: string | null;
  intro: string | null;
  notes: string | null;
  highlights: string[];
};

function partyCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function stayFromLegAndHotel(
  leg: TripLeg,
  hotel: { property_id: string | null; property_name: string | null } | null,
  party: { adults: number | null; children: number | null; rooms: number | null },
): TripStaySnapshot {
  return {
    leg_id: leg.id,
    city: leg.destination,
    check_in: leg.check_in,
    check_out: leg.check_out,
    property_id: hotel?.property_id ?? null,
    property_name: hotel?.property_name ?? null,
    destination_profile_id: leg.destination_profile_id,
    adults: party.adults,
    children: party.children,
    rooms: party.rooms,
  };
}

function seasonCodeFromExtracted(extracted: Record<string, unknown> | null): string | null {
  if (!extracted) return null;
  const raw = extracted.raw;
  if (!raw || typeof raw !== "object") return null;
  const code = (raw as Record<string, unknown>).season_code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function textFromExtracted(extracted: Record<string, unknown> | null, key: string): string | null {
  if (!extracted) return null;
  const raw = extracted.raw;
  if (!raw || typeof raw !== "object") return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toRateSnapshot(row: TripLineItem): TripRateSnapshot {
  return {
    id: row.id,
    leg_id: row.leg_id,
    title: row.title,
    subtitle: row.subtitle,
    property_name: row.property_name,
    currency: row.currency,
    sell_amount:
      row.sell_amount == null || !Number.isFinite(Number(row.sell_amount))
        ? null
        : Number(row.sell_amount),
    cost_internal: row.cost_internal,
    tax_percentage: row.tax_percentage,
    rate_source_code: row.rate_source_code,
    cancellation_policy: row.cancellation_policy,
    payment_policy: row.payment_policy,
    season_code: seasonCodeFromExtracted(row.extracted_json),
    property_id: row.property_id,
    contract_id: textFromExtracted(row.extracted_json, "contract_id"),
    rate_note: textFromExtracted(row.extracted_json, "notes"),
    inclusions: Array.isArray(row.inclusions)
      ? row.inclusions.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [],
    status: row.status,
    selected: row.selected,
  };
}

/** Line wording saved on the options quote. Unknown shapes become an empty map. */
export function parseLineEdits(
  value: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const raw = value?.line_edits;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const edits: Record<string, string> = {};
  for (const [key, text] of Object.entries(raw)) {
    if (typeof text !== "string") continue;
    const id = key.trim();
    if (!id || id.length > 120 || !/^[a-z0-9:_-]+$/i.test(id)) continue;
    edits[id] = text.slice(0, 2000);
  }
  return edits;
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

function toOptionsQuoteSnapshot(document: TripDocument | null): TripOptionsQuoteSnapshot {
  const narrative = parseQuoteNarrative(document?.narrative_json);
  return {
    title: narrative.title,
    notes: narrative.notes,
    line_edits: parseLineEdits(document?.narrative_json),
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

async function stayForLeg(
  tripId: string,
  leg: TripLeg,
): Promise<TripStaySnapshot> {
  const [selected, shell] = await Promise.all([
    findSelectedAccommodationLineItem(tripId, leg.id),
    findStayShellLineItem(tripId, leg.id),
  ]);
  const extracted = shell?.extracted_json;
  const party =
    extracted && typeof extracted === "object"
      ? {
          adults: partyCount(extracted.adults),
          children: partyCount(extracted.children),
          rooms: partyCount(extracted.rooms),
        }
      : { adults: null, children: null, rooms: null };
  return stayFromLegAndHotel(leg, selected ?? shell, party);
}

/** Every stay on the trip, earliest check-in first. */
export async function loadTripStays(tripId: string): Promise<TripStaySnapshot[]> {
  const legs = await listTripLegs(tripId);
  const stays = await Promise.all(legs.map((leg) => stayForLeg(tripId, leg)));
  return stays.sort((a, b) => {
    const aIn = a.check_in || "9999-99-99";
    const bIn = b.check_in || "9999-99-99";
    if (aIn !== bIn) return aIn < bIn ? -1 : 1;
    return a.city.localeCompare(b.city);
  });
}

/** First stay, or null. */
export async function loadTripStay(
  tripId: string,
): Promise<TripStaySnapshot | null> {
  const stays = await loadTripStays(tripId);
  return stays[0] ?? null;
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

/**
 * A date or quote save used to clear an omitted client. If the traveller
 * link is still there, put that client back on the trip row.
 */
async function tripWithClient(trip: Trip): Promise<Trip> {
  if (trip.primary_client_id) return trip;
  const linked = await findPrimaryTripClient(trip.id);
  if (!linked) return trip;
  const client = await findClientById(linked.client_id);
  const title = nextTripTitle(trip.title, { clientName: client?.display_name });
  const repaired = await dbUpdateTrip(trip.id, {
    primary_client_id: linked.client_id,
    ...(title ? { title } : {}),
  });
  return repaired ?? { ...trip, primary_client_id: linked.client_id, title: title ?? trip.title };
}

/** Studio aggregate for Trip Builder open-trip. */
export async function buildTripDetail(trip: Trip): Promise<TripDetail> {
  const current = await tripWithClient(trip);
  const [clientRow, stays, rates, document, optionsDocument, travellerRows, family] = await Promise.all([
    current.primary_client_id
      ? findClientById(current.primary_client_id)
      : Promise.resolve(null),
    loadTripStays(trip.id),
    loadTripRates(trip.id),
    findTripDocument(trip.id, "rates"),
    findTripDocument(trip.id, "options"),
    listTripTravellers(trip.id),
    current.primary_client_id
      ? findClientFamily(current.primary_client_id)
      : Promise.resolve(null),
  ]);

  const familyRoles = new Map(
    (family?.members ?? []).map((member) => [member.client_id, member.role]),
  );
  const travellers: TripTravellerSnapshot[] = travellerRows.map((row) => ({
    client_id: row.client_id,
    display_name: row.display_name,
    role: row.role,
    party_role: row.party_role,
    family_role: familyRoles.get(row.client_id) ?? null,
  }));
  const onTrip = new Set(travellers.map((row) => row.client_id));
  const familySuggestions: TripFamilySuggestion[] = (family?.members ?? [])
    .filter((member) => member.client_id !== current.primary_client_id && !onTrip.has(member.client_id))
    .map((member) => ({
      client_id: member.client_id,
      display_name: member.display_name,
      party_role: member.role === "child" ? "child" : "adult",
      family_role: member.role,
    }));

  return {
    trip: current,
    client: clientRow
      ? { id: clientRow.id, display_name: clientRow.display_name }
      : null,
    travellers,
    family_suggestions: familySuggestions,
    stay: stays[0] ?? null,
    stays,
    rates,
    quote: toQuoteSnapshot(current, document),
    options_quote: toOptionsQuoteSnapshot(optionsDocument),
    pricing_locked: Boolean(current.pricing_locked_at),
  };
}
