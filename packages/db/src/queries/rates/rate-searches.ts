import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  RateSearchEvent,
  RateSearchEventStatus,
  RateSearchResult,
} from "../../schema";

const EVENT_COLUMNS = [
  "id",
  "trip_id",
  "leg_id",
  "property_id",
  "requested_by_id",
  "destination_text",
  "routing_layer",
  "pattern",
  "sources_tried",
  "outcome",
  "meta",
  "check_in",
  "check_out",
  "adults",
  "children",
  "rooms",
  "status",
  "expires_at",
  "created_at",
].join(", ");

const RESULT_COLUMNS = [
  "id",
  "search_event_id",
  "rank",
  "property_id",
  "property_name",
  "room_title",
  "board",
  "team_cost",
  "currency",
  "rate_source_code",
  "availability_status",
  "recommended",
  "cancellation",
  "payment",
  "inclusions",
  "offer_rules",
  "raw",
  "created_at",
].join(", ");

export type InsertRateSearchEventInput = {
  trip_id: string | null;
  leg_id: string | null;
  property_id: string | null;
  requested_by_id: string | null;
  destination_text: string | null;
  routing_layer: number | null;
  pattern: string | null;
  sources_tried: unknown[];
  status: RateSearchEventStatus;
  meta: Record<string, unknown>;
  check_in: string | null;
  check_out: string | null;
  adults: number | null;
  children: number | null;
  rooms: number | null;
  expires_at: string | null;
};

export type InsertRateSearchResultInput = Omit<
  RateSearchResult,
  "id" | "search_event_id" | "created_at"
>;

export type StoredRateSearch = {
  event: RateSearchEvent;
  /** Room offers in the order the search returned them. */
  results: RateSearchResult[];
};

/**
 * Save one rate search and its room offers.
 * When the offers fail to save, the search row is removed so no half search is left.
 */
export async function insertRateSearch(input: {
  event: InsertRateSearchEventInput;
  results: InsertRateSearchResultInput[];
}): Promise<StoredRateSearch> {
  const supabase = getServiceClient();

  const { data: event, error: eventError } = await runSupabaseQuery(() =>
    supabase
      .from("rate_search_events")
      .insert({ ...input.event, outcome: input.event.status })
      .select(EVENT_COLUMNS)
      .single(),
  );

  if (eventError) {
    throw dbQueryError(eventError);
  }

  const saved = event as unknown as RateSearchEvent;
  if (input.results.length === 0) {
    return { event: saved, results: [] };
  }

  const { data: results, error: resultsError } = await runSupabaseQuery(() =>
    supabase
      .from("rate_search_results")
      .insert(input.results.map((row) => ({ ...row, search_event_id: saved.id })))
      .select(RESULT_COLUMNS)
      .order("rank", { ascending: true }),
  );

  if (resultsError) {
    await runSupabaseQuery(() =>
      supabase.from("rate_search_events").delete().eq("id", saved.id),
    );
    throw dbQueryError(resultsError);
  }

  return { event: saved, results: (results as unknown as RateSearchResult[]) ?? [] };
}

/** Latest trip search that is still open for follow-up questions. Null when none. */
export async function findLatestRateSearch(tripId: string): Promise<StoredRateSearch | null> {
  const supabase = getServiceClient();

  const { data: event, error: eventError } = await runSupabaseQuery(() =>
    supabase
      .from("rate_search_events")
      .select(EVENT_COLUMNS)
      .eq("trip_id", tripId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (eventError) {
    throw dbQueryError(eventError);
  }
  if (!event) return null;

  const saved = event as unknown as RateSearchEvent;
  const { data: results, error: resultsError } = await runSupabaseQuery(() =>
    supabase
      .from("rate_search_results")
      .select(RESULT_COLUMNS)
      .eq("search_event_id", saved.id)
      .order("rank", { ascending: true }),
  );

  if (resultsError) {
    throw dbQueryError(resultsError);
  }

  return { event: saved, results: (results as unknown as RateSearchResult[]) ?? [] };
}

/** Close every open search on a trip. Call after the trip, a stay, or a rate changes. */
export async function expireRateSearches(tripId: string): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("rate_search_events")
      .update({ expires_at: now })
      .eq("trip_id", tripId)
      .gt("expires_at", now),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
