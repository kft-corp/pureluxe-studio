import { errorCodeOf, type RateSnapshot } from "@pureluxe/ai";
import {
  expireRateSearches,
  findLatestRateSearch,
  insertRateSearch,
  type RateSearchEventStatus,
  type RateSearchResult,
  type StoredRateSearch,
} from "@pureluxe/db";
import type { NormalizedRateOption, SearchRatesResult } from "@pureluxe/rates";
import type { SearchRatesBody } from "@pureluxe/shared";

import { buildRateSearchNotes } from "./rate-search-pack";

/** How long the last hotel search stays open for follow-up questions. */
const FOLLOW_UP_TTL_MS = 30 * 60 * 1000;

type SearchMeta = {
  hotel_brief: string | null;
  markup: string | null;
};

function readMeta(meta: Record<string, unknown>): SearchMeta {
  const text = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : null);
  return { hotel_brief: text("hotel_brief"), markup: text("markup") };
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

/** The last open search as the agent's rates_get_snapshot result. */
export async function readRateSnapshot(tripId: string): Promise<RateSnapshot> {
  const search = await findLatestRateSearch(tripId);
  if (!search) return { status: "none" };
  return {
    status: "found",
    searched_at: search.event.created_at,
    hotel: search.results[0]?.property_name ?? null,
    check_in: search.event.check_in,
    check_out: search.event.check_out,
    room_count: search.results.length,
    notes: notesOf(search),
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
