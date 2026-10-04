/**
 * Atlas itinerary templates (not live trips).
 * Resolve uses these to create/fill legs for a country.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { KbItinerary, KbItineraryItem } from "../../schema";

export type ListKbItinerariesInput = {
  country_id?: string | null;
  country_code?: string | null;
  client_ready?: boolean | null;
  /** Default true — only active templates. */
  active_only?: boolean;
  limit?: number;
};

async function resolveCountryId(
  countryId: string | null | undefined,
  countryCode: string | null | undefined,
): Promise<string | null> {
  if (countryId) return countryId;
  if (!countryCode) return null;

  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_countries")
      .select("id")
      .eq("country_code", code)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as { id: string } | null)?.id ?? null;
}

/** List templates (prefer kb_verified ordering in @pureluxe/kb). */
export async function listKbItineraries(
  input: ListKbItinerariesInput = {},
): Promise<KbItinerary[]> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const countryId = await resolveCountryId(
    input.country_id,
    input.country_code,
  );

  if ((input.country_id || input.country_code) && !countryId) {
    return [];
  }

  const supabase = getServiceClient();

  let query = supabase.from("kb_itineraries").select("*").limit(limit);

  if (input.active_only !== false) {
    query = query.eq("active", true);
  }
  if (countryId) {
    query = query.eq("country_id", countryId);
  }
  if (typeof input.client_ready === "boolean") {
    query = query.eq("client_ready", input.client_ready);
  }

  query = query.order("title", { ascending: true });

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbItinerary[];
}

/**
 * Best active template for a country (verified first).
 * Used when advisor says a country name (§3.1).
 */
export async function findPreferredKbItineraryForCountry(
  countryId: string,
): Promise<KbItinerary | null> {
  const rows = await listKbItineraries({
    country_id: countryId,
    active_only: true,
    limit: 20,
  });

  if (rows.length === 0) return null;

  const verified = rows.find((row) => row.kb_tier === "kb_verified");
  if (verified) return verified;

  const scraped = rows.find((row) => row.kb_tier === "kb_scraped");
  return scraped ?? rows[0] ?? null;
}

export async function findKbItineraryById(
  itineraryId: string,
): Promise<KbItinerary | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_itineraries")
      .select("*")
      .eq("id", itineraryId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbItinerary | null;
}

/** Day items for a template, ordered for copy into trip_itinerary_days. */
export async function listKbItineraryItems(
  itineraryId: string,
): Promise<KbItineraryItem[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_itinerary_items")
      .select("*")
      .eq("itinerary_id", itineraryId)
      .order("day_number", { ascending: true })
      .order("sort_order", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbItineraryItem[];
}

export type KbItineraryBundle = {
  itinerary: KbItinerary;
  items: KbItineraryItem[];
};

export async function loadKbItineraryBundle(
  itineraryId: string,
): Promise<KbItineraryBundle | null> {
  const itinerary = await findKbItineraryById(itineraryId);
  if (!itinerary) return null;

  const items = await listKbItineraryItems(itineraryId);
  return { itinerary, items };
}
