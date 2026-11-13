/**
 * Atlas preferred-hotel shortlists for Trip Builder hotel_find.
 * Content plane only — no costs. Rate Layer remains the money path.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  HotelPriceTier,
  KbContractStatus,
  KbEntity,
  KbHotelDetails,
  KbHotelGuideScoreFactorKey,
  KbHotelGuideScoreFactors,
} from "../../schema";
import { KB_HOTEL_GUIDE_SCORE_FACTOR_KEYS } from "../../schema";
import {
  asHotelPriceTier,
  HOTEL_PRICE_TIER_RANK,
} from "../../utils/hotel-price-tier";

import { listActiveKbCountries, listActiveKbCitiesForCountry } from "./places";
import { listActiveKbEntities } from "./entities";
import { findKbHotelDetails, listKbHotelConsortia } from "./entity-details";

export type KbHotelSuggestHit = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  property_id: string | null;
  contract_status: KbContractStatus;
  luxury_band: HotelPriceTier | null;
  style_tags: string[];
  score: number;
  /** Neighbourhood / guide area (e.g. Marunouchi). */
  area: string | null;
  /** Partner / consortia label when known. */
  partner: string | null;
  /** One-line why from advisor_take / description. */
  why: string | null;
  /** Short "choose if" fit line from best_for / guide. */
  choose_if: string | null;
  /** Internal guide score when present (never show to clients). */
  guide_score: number | null;
  /** Internal guide matrix factors (full-name keys); omit unscored. Never show to clients. */
  guide_score_factors: KbHotelGuideScoreFactors;
};

type CityRow = {
  id: string;
  name: string;
  country_id: string;
  kb_countries: { name: string; country_code: string } | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function parseGuideScore(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const match = raw.trim().match(/^([0-9]+(?:\.[0-9]+)?)/);
    if (match) return Number(match[1]);
  }
  return null;
}

const GUIDE_FACTOR_KEYS = new Set<string>(KB_HOTEL_GUIDE_SCORE_FACTOR_KEYS);

function asGuideScoreFactors(raw: unknown): KbHotelGuideScoreFactors {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: KbHotelGuideScoreFactors = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!GUIDE_FACTOR_KEYS.has(key)) continue;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 1 || n > 5) continue;
    out[key as KbHotelGuideScoreFactorKey] = n;
  }
  return out;
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function firstSentence(text: string | null | undefined, max = 160): string | null {
  const cleaned = text?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const cut = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  if (cut.length <= max) return cut;
  return `${cut.slice(0, max - 1).trim()}…`;
}

function placeScore(place: string, city: string | null, country: string | null): number {
  const needle = norm(place);
  const cityName = city ? norm(city) : "";
  const countryName = country ? norm(country) : "";
  if (cityName === needle) return 1;
  if (countryName === needle) return 0.9;
  if (cityName.includes(needle) || needle.includes(cityName)) return 0.8;
  if (countryName.includes(needle) || needle.includes(countryName)) return 0.7;
  return 0.5;
}

function guideMeta(
  entity: KbEntity,
  details: KbHotelDetails | null,
): {
  area: string | null;
  partner: string | null;
  guide_score: number | null;
} {
  const ids = entity.external_ids ?? {};
  const area =
    details?.guide_area?.trim() ||
    (typeof ids.guide_area === "string" && ids.guide_area.trim()
      ? ids.guide_area.trim()
      : null);
  const partner =
    details?.guide_partner?.trim() ||
    (typeof ids.guide_partner === "string" && ids.guide_partner.trim()
      ? ids.guide_partner.trim()
      : null);
  const guide_score =
    details?.guide_score != null && Number.isFinite(Number(details.guide_score))
      ? Number(details.guide_score)
      : parseGuideScore(ids.guide_score);
  return { area: area || null, partner: partner || null, guide_score };
}

function chooseIfLine(details: KbHotelDetails | null, styleTags: string[]): string | null {
  const best = (details?.best_for ?? []).filter(Boolean);
  if (best.length > 0) {
    return `Choose if: ${best.slice(0, 3).join(", ")}.`;
  }
  if (styleTags.length > 0) {
    return `Choose if: ${styleTags.slice(0, 3).join(", ")}.`;
  }
  return null;
}

/** Rank: linked/shoppable → higher luxury band → guide score → name. */
export function compareKbHotelSuggestHits(a: KbHotelSuggestHit, b: KbHotelSuggestHit): number {
  const linked = Number(Boolean(b.property_id)) - Number(Boolean(a.property_id));
  if (linked !== 0) return linked;
  const tier =
    (b.luxury_band ? HOTEL_PRICE_TIER_RANK[b.luxury_band] : 0) -
    (a.luxury_band ? HOTEL_PRICE_TIER_RANK[a.luxury_band] : 0);
  if (tier !== 0) return tier;
  const score = (b.guide_score ?? 0) - (a.guide_score ?? 0);
  if (score !== 0) return score;
  const place = b.score - a.score;
  if (place !== 0) return place;
  return a.name.localeCompare(b.name);
}

async function enrichEntity(
  entity: KbEntity,
  cityName: string | null,
  countryName: string | null,
  score: number,
): Promise<KbHotelSuggestHit> {
  const [details, consortia] = await Promise.all([
    findKbHotelDetails(entity.id),
    listKbHotelConsortia(entity.id),
  ]);
  const meta = guideMeta(entity, details);
  const style_tags = details?.style_tags ?? [];
  const partner =
    meta.partner ??
    (consortia[0]?.club_name ? consortia[0].club_name : null);
  const why =
    firstSentence(entity.advisor_take, 180) ??
    firstSentence(entity.description, 180) ??
    (meta.area
      ? `${meta.area} base${partner ? `; ${partner}` : ""}.`
      : partner
        ? `On our preferred list (${partner}).`
        : null);

  return {
    id: entity.id,
    name: entity.name,
    city: cityName,
    country: countryName,
    property_id: entity.property_id,
    contract_status: entity.contract_status,
    luxury_band: asHotelPriceTier(details?.luxury_band),
    style_tags,
    score,
    area: meta.area,
    partner,
    why,
    choose_if: chooseIfLine(details, style_tags),
    guide_score: meta.guide_score,
    guide_score_factors: asGuideScoreFactors(details?.guide_score_factors),
  };
}

async function findCitiesByName(place: string): Promise<CityRow[]> {
  const trimmed = place.trim();
  if (trimmed.length < 2) return [];

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_cities")
      .select("id, name, country_id, kb_countries(name, country_code)")
      .eq("active", true)
      .ilike("name", trimmed)
      .neq("name", "Unspecified")
      .order("name", { ascending: true })
      .limit(8),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return ((data ?? []) as Array<{
    id: string;
    name: string;
    country_id: string;
    kb_countries:
      | { name: string; country_code: string }
      | { name: string; country_code: string }[]
      | null;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    country_id: row.country_id,
    kb_countries: one(row.kb_countries),
  }));
}

async function hotelsForCityIds(
  cities: CityRow[],
  place: string,
  limit: number,
): Promise<KbHotelSuggestHit[]> {
  const hits: KbHotelSuggestHit[] = [];
  const seen = new Set<string>();
  // Fetch a buffer so quality sort (tier / guide score) can beat alphabetical order.
  const fetchCap = Math.min(Math.max(limit * 6, 24), 60);

  for (const city of cities) {
    const rows = await listActiveKbEntities({
      city_id: city.id,
      entity_type: "hotel",
      include_placeholders: false,
      include_not_yet_contracted: true,
      limit: fetchCap,
    });
    const countryName = city.kb_countries?.name ?? null;
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      hits.push(
        await enrichEntity(
          row,
          city.name,
          countryName,
          placeScore(place, city.name, countryName),
        ),
      );
    }
  }

  return hits.sort(compareKbHotelSuggestHits).slice(0, limit);
}

/**
 * Preferred Atlas hotels for a city or country name (e.g. Kyoto, Japan).
 * Excludes placeholders and the Unspecified city bucket.
 * Ranked by linked → luxury band → guide score (not A–Z).
 */
export async function listKbHotelsForPlaceSuggest(input: {
  place: string;
  limit?: number;
}): Promise<KbHotelSuggestHit[]> {
  const place = input.place.trim();
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
  if (place.length < 2) return [];

  const cities = await findCitiesByName(place);
  if (cities.length > 0) {
    return hotelsForCityIds(cities, place, limit);
  }

  const countries = await listActiveKbCountries();
  const needle = norm(place);
  const country =
    countries.find((row) => norm(row.name) === needle) ??
    countries.find(
      (row) =>
        norm(row.name).includes(needle) ||
        needle.includes(norm(row.name)) ||
        norm(row.country_code) === needle,
    );
  if (!country) return [];

  const countryCities = (await listActiveKbCitiesForCountry(country.id)).filter(
    (row) => row.name !== "Unspecified",
  );
  const asRows: CityRow[] = countryCities.map((row) => ({
    id: row.id,
    name: row.name,
    country_id: row.country_id,
    kb_countries: { name: country.name, country_code: country.country_code },
  }));

  return hotelsForCityIds(asRows, place, limit);
}

/**
 * Atlas suggest meta for Rate Layer property ids (area / partner / why / choose_if).
 */
export async function listKbHotelSuggestByPropertyIds(
  propertyIds: string[],
): Promise<Map<string, KbHotelSuggestHit>> {
  const out = new Map<string, KbHotelSuggestHit>();
  const ids = [...new Set(propertyIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return out;

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("*, kb_cities(name), kb_countries(name)")
      .in("property_id", ids)
      .eq("active", true)
      .eq("entity_type", "hotel"),
  );
  if (error) throw dbQueryError(error);

  type Row = KbEntity & {
    kb_cities: { name: string } | { name: string }[] | null;
    kb_countries: { name: string } | { name: string }[] | null;
  };

  for (const row of (data ?? []) as Row[]) {
    const propertyId = row.property_id?.trim();
    if (!propertyId || out.has(propertyId)) continue;
    const cityName = one(row.kb_cities)?.name ?? null;
    const countryName = one(row.kb_countries)?.name ?? null;
    out.set(
      propertyId,
      await enrichEntity(row, cityName, countryName, 1),
    );
  }

  return out;
}

/**
 * Fuzzy Atlas hotel name lookup (fallback when Rate Layer has no match).
 */
export async function searchKbHotelsByName(input: {
  query: string;
  place?: string | null;
  limit?: number;
}): Promise<KbHotelSuggestHit[]> {
  const query = input.query.trim();
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
  if (query.length < 2) return [];

  const rows = await listActiveKbEntities({
    q: query,
    entity_type: "hotel",
    include_placeholders: false,
    include_not_yet_contracted: true,
    limit: Math.min(limit * 4, 24),
  });

  const place = input.place?.trim() || null;
  const hits: KbHotelSuggestHit[] = [];

  for (const row of rows) {
    let cityName: string | null = null;
    let countryName: string | null = null;
    if (row.city_id || row.country_id) {
      const supabase = getServiceClient();
      const { data, error } = await runSupabaseQuery(() =>
        supabase
          .from("kb_entities")
          .select("id, kb_cities(name), kb_countries(name)")
          .eq("id", row.id)
          .maybeSingle(),
      );
      if (error) throw dbQueryError(error);
      const embed = data as {
        kb_cities: { name: string } | { name: string }[] | null;
        kb_countries: { name: string } | { name: string }[] | null;
      } | null;
      cityName = one(embed?.kb_cities)?.name ?? null;
      countryName = one(embed?.kb_countries)?.name ?? null;
    }

    if (place) {
      const needle = norm(place);
      const hay = `${cityName ?? ""} ${countryName ?? ""}`.toLowerCase();
      if (
        !hay.includes(needle) &&
        needle !== norm(cityName ?? "") &&
        needle !== norm(countryName ?? "")
      ) {
        continue;
      }
    }

    const nameHit =
      norm(row.name).includes(norm(query)) || norm(query).includes(norm(row.name));
    hits.push(
      await enrichEntity(row, cityName, countryName, nameHit ? 0.85 : 0.55),
    );
  }

  return hits.sort(compareKbHotelSuggestHits).slice(0, limit);
}
