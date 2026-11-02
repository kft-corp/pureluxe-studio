import type { RateCompareCard } from "@pureluxe/ai";
import {
  findActivePropertyById,
  findLatestRateSearch,
  listActiveHotelsInDestination,
  listClientPreferences,
  listTripTravellers,
  type ClientPreference,
  type Property,
  type RateSearchResult,
  type StoredRateSearch,
} from "@pureluxe/db";
import { searchRatesForLeg, type NormalizedRateOption, type SearchRatesResult } from "@pureluxe/rates";

import { matchPropertyByName } from "@/lib/rates/match-property";
import { saveMultiHotelRateSearch } from "@/lib/rates/rate-search-store";

import { requireEditableTrip } from "../access/require-assigned-trip";
import { loadHotelStayFacts } from "../stays/hotel-contract-facts";

import { buildRateCompare } from "./build-rate-compare";
import { loadPartyPricingContext } from "./party-pricing-context";
import { previousSearchCoversRequest } from "./rate-search-fingerprint";

const ROOM_PREF =
  /\b(room|hotel|bed|connect|quiet|view|villa|suite|family|floor|ocean|beach|pool|transfer)\b/i;

/** One short preference line for the rate compare card. */
async function loadRatePreference(tripId: string): Promise<string | null> {
  const travellers = await listTripTravellers(tripId);
  const lead = travellers.find((row) => row.role === "primary") ?? travellers[0];
  if (!lead) return null;
  const prefs = await listClientPreferences(lead.client_id, { limit: 40 });
  const active = prefs.filter((row) => row.active);
  const roomish = (row: ClientPreference) =>
    ROOM_PREF.test(row.label) || ROOM_PREF.test(row.category);
  const pick =
    active.find((row) => row.sentiment === "require" && roomish(row)) ??
    active.find((row) => row.sentiment === "prefer" && roomish(row)) ??
    active.find((row) => row.sentiment === "avoid" && roomish(row)) ??
    active.find((row) => row.sentiment === "require") ??
    active.find((row) => row.sentiment === "prefer") ??
    null;
  if (!pick) return null;
  const name = lead.display_name?.trim() || "Client";
  const verb =
    pick.sentiment === "require"
      ? "requires"
      : pick.sentiment === "avoid"
        ? "avoids"
        : "prefers";
  return `${name} ${verb} ${pick.label}.`;
}

const SEARCH_TIMEOUT_MS = 25_000;

export type HotelRateSearchStatus =
  | "ok"
  | "no_rates"
  | "not_in_pureluxe"
  | "several_matches"
  | "offline"
  | "timeout";

export type HotelRateSearchOutcome = {
  hotel: string;
  status: HotelRateSearchStatus;
  property_id: string | null;
  options: NormalizedRateOption[];
  /** rate_search_results.id per option, same order. */
  result_ids: string[];
  min_markup_percent: number | null;
  note: string | null;
  alternatives: string[];
};

export type SearchRatesForHotelsInput = {
  tripId: string;
  destination: string;
  hotels: string[];
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  /** Stated child ages; preferred over passport DOBs when set. */
  childAges?: number[];
};

export type SearchRatesForHotelsResult = {
  destination: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: Array<Omit<HotelRateSearchOutcome, "options"> & { option_count: number }>;
  compare: RateCompareCard;
  /**
   * False when dates/party/rooms match the last open search and every requested
   * hotel was already in that search (incl. a 1-hotel re-pull after markup).
   * Studio then skips re-showing the rate card.
   */
  show_compare_card: boolean;
  notes: string;
  preference: string | null;
};

function optionFromStoredRow(
  row: RateSearchResult,
  search: StoredRateSearch,
): NormalizedRateOption {
  return {
    property_id: row.property_id,
    property_name: row.property_name,
    room_name: row.room_title,
    board: row.board,
    check_in: search.event.check_in ?? "",
    check_out: search.event.check_out ?? "",
    currency: row.currency,
    cost_internal: Number(row.team_cost),
    rate_source_code: row.rate_source_code as NormalizedRateOption["rate_source_code"],
    inclusions: row.inclusions,
    cancellation_summary: row.cancellation,
    payment_summary: row.payment,
    availability_status: row.availability_status,
    recommended: row.recommended,
    raw: row.raw,
  };
}

/** Rebuild hotel outcomes from the last open search (no live re-pull). */
function outcomesFromStoredSearch(search: StoredRateSearch): HotelRateSearchOutcome[] {
  const metaHotels = Array.isArray(search.event.meta?.hotels)
    ? search.event.meta.hotels.filter((name): name is string => typeof name === "string")
    : [];
  const byHotel = new Map<string, RateSearchResult[]>();
  for (const row of search.results) {
    const key = row.property_name?.trim() || "hotel";
    const list = byHotel.get(key) ?? [];
    list.push(row);
    byHotel.set(key, list);
  }

  const hotelNames =
    metaHotels.length > 0 ? metaHotels : [...byHotel.keys()];

  return hotelNames.map((hotel) => {
    const rows =
      [...byHotel.entries()].find(([name]) => {
        const left = name.trim().toLowerCase();
        const right = hotel.trim().toLowerCase();
        return left === right || left.includes(right) || right.includes(left);
      })?.[1] ?? [];
    const options = rows.map((row) => optionFromStoredRow(row, search));
    const propertyId = options[0]?.property_id ?? null;
    return {
      hotel,
      status: options.length > 0 ? ("ok" as const) : ("no_rates" as const),
      property_id: propertyId,
      options,
      result_ids: rows.map((row) => row.id),
      min_markup_percent: null,
      note:
        options.length > 0
          ? null
          : "No rates in the last search for this hotel.",
      alternatives: [],
    };
  });
}

function resultFromOutcomes(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: HotelRateSearchOutcome[];
  preference: string | null;
  showCompareCard: boolean;
  notes: string;
  searchedAt: string | null;
}): SearchRatesForHotelsResult {
  const compare = buildRateCompare({
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    hotels: input.hotels,
    preference: input.preference,
    searchedAt: input.searchedAt,
  });
  return {
    destination: input.destination,
    check_in: input.checkIn,
    check_out: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    hotels: input.hotels.map(({ options, ...rest }) => ({
      ...rest,
      option_count: options.length,
    })),
    compare,
    show_compare_card: input.showCompareCard,
    notes: input.notes,
    preference: input.preference,
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function alternativesInDestination(
  destination: string,
  excludeId: string | null,
): Promise<string[]> {
  const hotels = await listActiveHotelsInDestination({
    destination,
    excludePropertyIds: excludeId ? [excludeId] : [],
    limit: 6,
  });
  return hotels.map((row) => row.name).slice(0, 3);
}

async function outcomeFromSearch(
  property: Property,
  result: SearchRatesResult,
): Promise<HotelRateSearchOutcome> {
  const facts = await loadHotelStayFacts({
    propertyId: property.id,
    checkIn: result.options[0]?.check_in ?? "",
    checkOut: result.options[0]?.check_out ?? "",
    contractId: null,
  });
  const fromNotes = facts?.markup ? Number(facts.markup.match(/(\d+(?:\.\d+)?)/)?.[1]) : null;
  const minMarkup = property.min_markup_percent ?? (Number.isFinite(fromNotes) ? fromNotes : null);

  if (result.status === "consultant_required") {
    return {
      hotel: property.name,
      status: "offline",
      property_id: property.id,
      options: [],
      result_ids: [],
      min_markup_percent: minMarkup,
      note: "This hotel is offline for rates. Paste a supplier quote.",
      alternatives: [],
    };
  }

  if (result.options.length === 0 || result.status === "empty" || result.status === "stub") {
    const alternatives = await alternativesInDestination(
      property.destination ?? property.country ?? "",
      property.id,
    );
    return {
      hotel: property.name,
      status: "no_rates",
      property_id: property.id,
      options: [],
      result_ids: [],
      min_markup_percent: minMarkup,
      note: alternatives.length
        ? `No rates for these dates at ${property.name}. Try ${alternatives.join(", ")}, or paste a supplier quote.`
        : `No rates for these dates at ${property.name}. Paste a supplier quote.`,
      alternatives,
    };
  }

  const options = result.options.map((option) => ({
    ...option,
    payment_summary:
      option.payment_summary ??
      facts?.paymentLines.map((line) => line.trim()).filter(Boolean).join(" ") ??
      null,
  }));

  return {
    hotel: property.name,
    status: "ok",
    property_id: property.id,
    options,
    result_ids: [],
    min_markup_percent: minMarkup,
    note: null,
    alternatives: [],
  };
}

async function searchOneHotel(input: {
  tripId: string;
  destination: string;
  hotel: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  childAges: number[];
  marketCodes: string[];
  memberId: string;
}): Promise<HotelRateSearchOutcome> {
  const match = await matchPropertyByName(input.hotel);
  if (match.status === "several") {
    return {
      hotel: input.hotel,
      status: "several_matches",
      property_id: null,
      options: [],
      result_ids: [],
      min_markup_percent: null,
      note: `Several hotels match "${input.hotel}": ${match.names.join(", ")}. Say the exact name.`,
      alternatives: match.names.slice(0, 3),
    };
  }
  if (match.status === "none" || !match.property) {
    const alternatives = await alternativesInDestination(input.destination, null);
    return {
      hotel: input.hotel,
      status: "not_in_pureluxe",
      property_id: null,
      options: [],
      result_ids: [],
      min_markup_percent: null,
      note: alternatives.length
        ? `No match for "${input.hotel}". Similar: ${alternatives.join(", ")}, or paste a supplier quote.`
        : `No match for "${input.hotel}". Paste a supplier quote, or ask for suggestions.`,
      alternatives,
    };
  }

  const property = match.property;
  try {
    const result = await withTimeout(
      searchRatesForLeg({
        trip_id: input.tripId,
        destination_text: input.destination,
        property_id: property.id,
        check_in: input.checkIn,
        check_out: input.checkOut,
        adults: input.adults,
        children: input.children,
        rooms: input.rooms,
        child_ages: input.childAges,
        client_market_codes: input.marketCodes,
        channel: "studio",
        requested_by_id: input.memberId,
      }),
      SEARCH_TIMEOUT_MS,
    );
    return await outcomeFromSearch(property, result);
  } catch (cause) {
    if (cause instanceof Error && cause.message === "timeout") {
      const alternatives = await alternativesInDestination(input.destination, property.id);
      return {
        hotel: property.name,
        status: "timeout",
        property_id: property.id,
        options: [],
        result_ids: [],
        min_markup_percent: property.min_markup_percent,
        note: "Rates for this hotel are delayed. Try again, or paste a supplier quote.",
        alternatives,
      };
    }
    throw cause;
  }
}

/**
 * Search rates for up to 5 hotels in parallel. No saved stay required.
 * Persists one multi-hotel search event for follow-up questions.
 * Same dates/party with hotels already covered by the last search: reuse that
 * snapshot (no live pull, no new card) so markup re-searches cannot re-open the table.
 */
export async function searchRatesForHotels(
  input: SearchRatesForHotelsInput,
  actor: { memberId: string },
): Promise<SearchRatesForHotelsResult> {
  await requireEditableTrip(input.tripId, actor.memberId);
  const hotels = [...new Set(input.hotels.map((name) => name.trim()).filter(Boolean))].slice(0, 5);

  const [party, preference, previousSearch] = await Promise.all([
    loadPartyPricingContext({
      tripId: input.tripId,
      checkIn: input.checkIn,
      childAges: input.childAges,
    }),
    loadRatePreference(input.tripId),
    findLatestRateSearch(input.tripId),
  ]);

  if (
    previousSearch &&
    hotels.length > 0 &&
    previousSearchCoversRequest(previousSearch, {
      destination: input.destination,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
      hotels,
    })
  ) {
    const reused = outcomesFromStoredSearch(previousSearch);
    return resultFromOutcomes({
      destination: previousSearch.event.destination_text ?? input.destination,
      checkIn: previousSearch.event.check_in ?? input.checkIn,
      checkOut: previousSearch.event.check_out ?? input.checkOut,
      adults: previousSearch.event.adults ?? input.adults,
      children: previousSearch.event.children ?? input.children,
      rooms: previousSearch.event.rooms ?? input.rooms,
      hotels: reused,
      preference,
      showCompareCard: false,
      notes:
        "Same dates, party and hotels as the last rate search — reused those rates. Rate table not shown again. For markup or sell only, use quote_add_options / quote_set_client_price; do not say you refreshed rates.",
      searchedAt: previousSearch.event.created_at,
    });
  }

  const outcomes =
    hotels.length === 0
      ? []
      : await Promise.all(
          hotels.map((hotel) =>
            searchOneHotel({
              tripId: input.tripId,
              destination: input.destination,
              hotel,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              rooms: input.rooms,
              adults: input.adults,
              children: input.children,
              childAges: party.child_ages,
              marketCodes: party.client_market_codes,
              memberId: actor.memberId,
            }),
          ),
        );

  const saved = await saveMultiHotelRateSearch({
    tripId: input.tripId,
    memberId: actor.memberId,
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    hotels: outcomes,
  });

  const withIds = outcomes.map((outcome, index) => ({
    ...outcome,
    result_ids: saved.hotelResultIds[index] ?? [],
  }));

  return resultFromOutcomes({
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    hotels: withIds,
    preference,
    showCompareCard: true,
    notes: saved.notes,
    searchedAt: saved.searchedAt ?? new Date().toISOString(),
  });
}

/** Resolve a property's minimum markup (for quote tools). */
export async function propertyMinMarkup(propertyId: string): Promise<number | null> {
  const property = await findActivePropertyById(propertyId);
  return property?.min_markup_percent ?? null;
}
