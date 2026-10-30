import { errorCodeOf, type RateSnapshot } from "@pureluxe/ai";
import {
  expireRateSearches,
  findLatestRateSearch,
  findRateSearchByEventId,
  findRateSearchResultById,
  insertRateSearch,
  type RateSearchEventStatus,
  type RateSearchResult,
  type StoredRateSearch,
} from "@pureluxe/db";
import type { NormalizedRateOption, SearchRatesResult } from "@pureluxe/rates";
import type { SearchRatesBody } from "@pureluxe/shared";

import { buildRateSearchNotes } from "./rate-search-pack";
import { bestRoomMatch, hotelNameMatch } from "./room-match";
import type { HotelRateSearchOutcome } from "@/lib/trip-builder/rates/search-rates-for-hotels";

/** How long the last hotel search stays open for follow-up questions. */
const FOLLOW_UP_TTL_MS = 30 * 60 * 1000;

type SearchMeta = {
  hotel_brief: string | null;
  markup: string | null;
  hotels?: string[];
};

function readMeta(meta: Record<string, unknown>): SearchMeta {
  const text = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : null);
  const hotels = Array.isArray(meta.hotels)
    ? meta.hotels.filter((name): name is string => typeof name === "string")
    : [];
  return { hotel_brief: text("hotel_brief"), markup: text("markup"), hotels };
}

function toOption(row: RateSearchResult, search: StoredRateSearch): NormalizedRateOption {
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

function notesOf(search: StoredRateSearch): string {
  const meta = readMeta(search.event.meta);
  return buildRateSearchNotes(
    search.results.map((row) => toOption(row, search)),
    meta.hotel_brief,
    meta.markup,
  );
}

/**
 * Remember a trip's rate search for follow-up questions (any server, any reload).
 * Team cost and hotel rules are stored; bank payout never is.
 * Never throws: the advisor still gets the rates when saving them fails.
 */
export async function saveTripRateSearch(input: {
  search: SearchRatesBody;
  propertyId: string | null;
  memberId: string;
  result: SearchRatesResult;
  options: NormalizedRateOption[];
  hotelBrief: string | null;
  markup: string | null;
}): Promise<void> {
  const { search, result } = input;
  if (!search.trip_id) return;

  const saving = insertRateSearch({
    event: {
      trip_id: search.trip_id,
      leg_id: search.leg_id ?? null,
      property_id: input.propertyId,
      requested_by_id: input.memberId,
      destination_text: search.destination_text ?? null,
      routing_layer: result.routing.layer,
      pattern: result.routing.pattern,
      sources_tried: result.routing.sources_tried,
      status: result.status as RateSearchEventStatus,
      meta: { hotel_brief: input.hotelBrief, markup: input.markup } satisfies SearchMeta,
      check_in: search.check_in,
      check_out: search.check_out,
      adults: search.adults,
      children: search.children,
      rooms: search.rooms,
      expires_at: new Date(Date.now() + FOLLOW_UP_TTL_MS).toISOString(),
    },
    results: input.options.map((option, rank) => ({
      rank,
      property_id: option.property_id,
      property_name: option.property_name,
      room_title: option.room_name?.trim() || option.property_name?.trim() || "Room",
      board: option.board,
      team_cost: option.cost_internal,
      currency: option.currency,
      rate_source_code: option.rate_source_code,
      availability_status: option.availability_status,
      recommended: option.recommended,
      cancellation: option.cancellation_summary,
      payment: option.payment_summary,
      inclusions: option.inclusions,
      offer_rules: [],
      raw: option.raw,
    })),
  });

  try {
    await saving;
  } catch (cause) {
    console.error("[rate_search_events] save failed:", errorCodeOf(cause));
  }
}

function multiHotelNotes(hotels: HotelRateSearchOutcome[]): string {
  const lines: string[] = [];
  for (const hotel of hotels) {
    if (hotel.status !== "ok") {
      lines.push(`${hotel.hotel}: ${hotel.note ?? hotel.status}`);
      continue;
    }
    lines.push(`${hotel.hotel}:`);
    for (const option of hotel.options) {
      const scope = option.raw?.pricing_scope === "per_room" ? "per room" : "total";
      lines.push(
        `  - ${option.room_name ?? "Room"}: ${option.currency} ${option.cost_internal} (${scope})${
          option.cancellation_summary ? ` · ${option.cancellation_summary}` : ""
        }`,
      );
    }
  }
  return lines.join("\n");
}

/**
 * Persist a multi-hotel search as one event so rates_get_snapshot and quote tools
 * can resolve rate_ref ids. Returns result ids per hotel in input order.
 */
export async function saveMultiHotelRateSearch(input: {
  tripId: string;
  memberId: string;
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: HotelRateSearchOutcome[];
}): Promise<{ hotelResultIds: string[][]; notes: string; searchedAt: string | null }> {
  const notes = multiHotelNotes(input.hotels);
  const results: Array<{
    hotelIndex: number;
    optionIndex: number;
    row: Parameters<typeof insertRateSearch>[0]["results"][number];
  }> = [];

  input.hotels.forEach((hotel, hotelIndex) => {
    hotel.options.forEach((option, optionIndex) => {
      results.push({
        hotelIndex,
        optionIndex,
        row: {
          rank: results.length,
          property_id: option.property_id,
          property_name: option.property_name ?? hotel.hotel,
          room_title: option.room_name?.trim() || option.property_name?.trim() || "Room",
          board: option.board,
          team_cost: option.cost_internal,
          currency: option.currency,
          rate_source_code: option.rate_source_code,
          availability_status: option.availability_status,
          recommended: option.recommended,
          cancellation: option.cancellation_summary,
          payment: option.payment_summary,
          inclusions: option.inclusions,
          offer_rules: [],
          raw: option.raw,
        },
      });
    });
  });

  const anyOk = input.hotels.some((hotel) => hotel.status === "ok");
  try {
    const saved = await insertRateSearch({
      event: {
        trip_id: input.tripId,
        leg_id: null,
        property_id: null,
        requested_by_id: input.memberId,
        destination_text: input.destination,
        routing_layer: null,
        pattern: "multi_hotel",
        sources_tried: [],
        status: (anyOk ? "ok" : "empty") as RateSearchEventStatus,
        meta: {
          hotel_brief: null,
          markup: null,
          hotels: input.hotels.map((hotel) => hotel.hotel),
        } satisfies SearchMeta,
        check_in: input.checkIn,
        check_out: input.checkOut,
        adults: input.adults,
        children: input.children,
        rooms: input.rooms,
        expires_at: new Date(Date.now() + FOLLOW_UP_TTL_MS).toISOString(),
      },
      results: results.map((item) => item.row),
    });

    const hotelResultIds = input.hotels.map(() => [] as string[]);
    results.forEach((item, index) => {
      const id = saved.results[index]?.id;
      if (id) hotelResultIds[item.hotelIndex]?.push(id);
    });
    return { hotelResultIds, notes, searchedAt: saved.event.created_at };
  } catch (cause) {
    console.error("[rate_search_events] multi-hotel save failed:", errorCodeOf(cause));
    return { hotelResultIds: input.hotels.map(() => []), notes, searchedAt: null };
  }
}

/** The last open search as the agent's rates_get_snapshot result. */
export async function readRateSnapshot(tripId: string): Promise<RateSnapshot> {
  const search = await findLatestRateSearch(tripId);
  if (!search) return { status: "none" };
  const meta = readMeta(search.event.meta);
  const hotels =
    meta.hotels && meta.hotels.length > 0
      ? meta.hotels
      : [...new Set(search.results.map((row) => row.property_name).filter(Boolean) as string[])];
  return {
    status: "found",
    searched_at: search.event.created_at,
    hotel: hotels.length === 1 ? hotels[0]! : hotels[0] ?? null,
    hotels,
    check_in: search.event.check_in,
    check_out: search.event.check_out,
    adults: search.event.adults,
    children: search.event.children,
    rooms: search.event.rooms,
    room_count: search.results.length,
    notes: notesOf(search),
  };
}

/** Load a stored offer as a NormalizedRateOption for quote_add_options. */
export async function loadStoredRateOption(
  resultId: string,
): Promise<{
  option: NormalizedRateOption;
  result: RateSearchResult;
  legId: string | null;
  destinationText: string | null;
} | null> {
  const result = await findRateSearchResultById(resultId);
  if (!result) return null;
  const search = await findRateSearchByEventId(result.search_event_id);
  const option: NormalizedRateOption = {
    property_id: result.property_id,
    property_name: result.property_name,
    room_name: result.room_title,
    board: result.board,
    check_in: search?.event.check_in ?? "",
    check_out: search?.event.check_out ?? "",
    currency: result.currency,
    cost_internal: Number(result.team_cost),
    rate_source_code: result.rate_source_code as NormalizedRateOption["rate_source_code"],
    inclusions: result.inclusions,
    cancellation_summary: result.cancellation,
    payment_summary: result.payment,
    availability_status: result.availability_status,
    recommended: result.recommended,
    raw: result.raw,
  };
  return {
    option,
    result,
    legId: search?.event.leg_id ?? null,
    destinationText: search?.event.destination_text ?? null,
  };
}

/** Match a hotel+room against the latest open search. */
export async function findStoredRateByHotelRoom(
  tripId: string,
  hotel: string,
  room: string,
): Promise<{
  option: NormalizedRateOption;
  resultId: string;
  legId: string | null;
  destinationText: string | null;
} | null> {
  const search = await findLatestRateSearch(tripId);
  if (!search) return null;
  const atHotel = search.results.filter((row) =>
    hotelNameMatch(row.property_name ?? "", hotel),
  );
  const pool = atHotel.length > 0 ? atHotel : search.results;
  const hit = bestRoomMatch(pool, room, (row) => row.room_title);
  if (!hit) return null;
  return {
    option: toOption(hit, search),
    resultId: hit.id,
    legId: search.event.leg_id ?? null,
    destinationText: search.event.destination_text ?? null,
  };
}

/**
 * Close the trip's open searches after the trip, a stay, or a rate is written, so
 * follow-up questions never use stale prices.
 * Never throws: the write that called this has already succeeded.
 */
export async function closeTripRateSearches(tripId: string): Promise<void> {
  try {
    await expireRateSearches(tripId);
  } catch (cause) {
    console.error("[rate_search_events] expire failed:", errorCodeOf(cause));
  }
}
