/**
 * Atlas KB place queries (geography + country/city facts + visa).
 *
 * Naming: find* one row | list* many | load* bundled read for resolve/API.
 * No ranking / cap / view rules — those belong in @pureluxe/kb.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbCity,
  KbCountry,
  KbCountryFacts,
  KbCountryVisaRule,
  KbDestinationAudienceNote,
  KbDestinationFacts,
  KbRegion,
  KbTripStyle,
} from "../../schema";

function normalizeCountryCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Active regions (Atlas place tree root). */
export async function listActiveKbRegions(): Promise<KbRegion[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_regions")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbRegion[];
}

/** Active countries, optionally scoped to a region. */
export async function listActiveKbCountries(input?: {
  region_id?: string | null;
}): Promise<KbCountry[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("kb_countries")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });

  if (input?.region_id) {
    query = query.eq("region_id", input.region_id);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbCountry[];
}

/** Active region by id. */
export async function findActiveKbRegionById(
  regionId: string,
): Promise<KbRegion | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_regions")
      .select("*")
      .eq("id", regionId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbRegion | null;
}

/** Active country by ISO country_code (JP, IN). */
export async function findActiveKbCountryByCode(
  countryCode: string,
): Promise<KbCountry | null> {
  const code = normalizeCountryCode(countryCode);
  if (!/^[A-Z]{2}$/.test(code)) return null;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_countries")
      .select("*")
      .eq("country_code", code)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCountry | null;
}

/** Active country by id. */
export async function findActiveKbCountryById(
  countryId: string,
): Promise<KbCountry | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_countries")
      .select("*")
      .eq("id", countryId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCountry | null;
}

/** Active city by id. */
export async function findActiveKbCityById(
  cityId: string,
): Promise<KbCity | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_cities")
      .select("*")
      .eq("id", cityId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCity | null;
}

/** Active city by country + exact name (case-insensitive). */
export async function findActiveKbCityByCountryAndName(
  countryId: string,
  name: string,
): Promise<KbCity | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_cities")
      .select("*")
      .eq("country_id", countryId)
      .eq("active", true)
      .ilike("name", trimmed)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCity | null;
}

/** Active cities for one country (resolve country → per-city legs). */
export async function listActiveKbCitiesForCountry(
  countryId: string,
): Promise<KbCity[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_cities")
      .select("*")
      .eq("country_id", countryId)
      .eq("active", true)
      .order("name", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbCity[];
}

/** Country facts sheet (1:1). Null if none yet. */
export async function findKbCountryFacts(
  countryId: string,
): Promise<KbCountryFacts | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_country_facts")
      .select("*")
      .eq("country_id", countryId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCountryFacts | null;
}

/** Visa rule for destination country + passport. Null = honest empty. */
export async function findActiveKbVisaRule(
  countryId: string,
  passportCountryCode: string,
): Promise<KbCountryVisaRule | null> {
  const passport = normalizeCountryCode(passportCountryCode);
  if (!/^[A-Z]{2}$/.test(passport)) return null;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_country_visa_rules")
      .select("*")
      .eq("country_id", countryId)
      .eq("passport_country_code", passport)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCountryVisaRule | null;
}

/** City destination facts (1:1). */
export async function findKbDestinationFacts(
  cityId: string,
): Promise<KbDestinationFacts | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_destination_facts")
      .select("*")
      .eq("city_id", cityId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbDestinationFacts | null;
}

/** Optional trip-style note for a city (honeymoon / family / …). */
export async function findActiveKbDestinationAudienceNote(
  cityId: string,
  tripStyle: KbTripStyle,
): Promise<KbDestinationAudienceNote | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_destination_audience_notes")
      .select("*")
      .eq("city_id", cityId)
      .eq("trip_style", tripStyle)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbDestinationAudienceNote | null;
}

export type KbCountryPlaceBundle = {
  country: KbCountry;
  facts: KbCountryFacts | null;
  visa: KbCountryVisaRule | null;
  cities: KbCity[];
};

/**
 * One round-trip set for GET /places/countries/[country_code] and resolve.
 * Visa is null when no row — callers must not invent text.
 */
export async function loadKbCountryPlaceBundle(input: {
  country_code: string;
  passport_country_code: string;
}): Promise<KbCountryPlaceBundle | null> {
  const country = await findActiveKbCountryByCode(input.country_code);
  if (!country) return null;

  const [facts, visa, cities] = await Promise.all([
    findKbCountryFacts(country.id),
    findActiveKbVisaRule(country.id, input.passport_country_code),
    listActiveKbCitiesForCountry(country.id),
  ]);

  return { country, facts, visa, cities };
}

/** Lightweight entity counts for a city place page. */
export async function countActiveKbEntitiesByTypeForCity(
  cityId: string,
): Promise<Record<string, number>> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("entity_type")
      .eq("city_id", cityId)
      .eq("active", true)
      .eq("placeholder", false),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { entity_type: string }[]) {
    counts[row.entity_type] = (counts[row.entity_type] ?? 0) + 1;
  }
  return counts;
}

export type KbCityPlaceBundle = {
  city: KbCity;
  country: KbCountry | null;
  facts: KbDestinationFacts | null;
  audience_note: KbDestinationAudienceNote | null;
  entity_counts: Record<string, number>;
};

/** City page + optional audience note (GET /places/cities/[id]). */
export async function loadKbCityPlaceBundle(input: {
  city_id: string;
  trip_style?: KbTripStyle | null;
}): Promise<KbCityPlaceBundle | null> {
  const city = await findActiveKbCityById(input.city_id);
  if (!city) return null;

  const [country, facts, audience_note, entity_counts] = await Promise.all([
    findActiveKbCountryById(city.country_id),
    findKbDestinationFacts(city.id),
    input.trip_style
      ? findActiveKbDestinationAudienceNote(city.id, input.trip_style)
      : Promise.resolve(null),
    countActiveKbEntitiesByTypeForCity(city.id),
  ]);

  return { city, country, facts, audience_note, entity_counts };
}

export type UpsertKbVisaRuleInput = {
  country_id: string;
  passport_country_code: string;
  summary: string;
  details?: string | null;
  entry_type?: KbCountryVisaRule["entry_type"];
  official_url?: string | null;
  kb_tier?: KbCountryVisaRule["kb_tier"];
  provenance?: KbCountryVisaRule["provenance"];
  verified_by_id?: string | null;
  verified_at?: string | null;
  last_reviewed_at?: string | null;
  active?: boolean;
};

/** Human upsert of one visa row (unique country + passport). */
export async function upsertKbVisaRule(
  input: UpsertKbVisaRuleInput,
): Promise<KbCountryVisaRule> {
  const passport = normalizeCountryCode(input.passport_country_code);
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_country_visa_rules")
      .upsert(
        {
          country_id: input.country_id,
          passport_country_code: passport,
          summary: input.summary.trim(),
          details: input.details ?? null,
          entry_type: input.entry_type ?? null,
          official_url: input.official_url ?? null,
          kb_tier: input.kb_tier ?? "kb_scraped",
          provenance: input.provenance ?? "kb",
          verified_by_id: input.verified_by_id ?? null,
          verified_at: input.verified_at ?? null,
          last_reviewed_at: input.last_reviewed_at ?? null,
          active: input.active ?? true,
        },
        { onConflict: "country_id,passport_country_code" },
      )
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbCountryVisaRule;
}
