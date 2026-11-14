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

/**
 * Ranking context for matrix-weighted hotel suggest (behind the scenes).
 * Party from trip travellers; ask from the advisor message; prefs from client profile.
 */
export type HotelSuggestParty = {
  adults?: number | null;
  children?: number | null;
  /** Advisor ask / destination query (romantic, spa, family, business, …). */
  ask?: string | null;
  /** Client preference / diet labels (e.g. connecting rooms, pescatarian, avoid nightlife). */
  prefHints?: string[] | null;
};

/** @deprecated Use HotelSuggestParty (same shape; kept for call-site clarity). */
export type HotelSuggestRankContext = HotelSuggestParty;

function bump(
  weights: Partial<Record<KbHotelGuideScoreFactorKey, number>>,
  key: KbHotelGuideScoreFactorKey,
  factor: number,
): void {
  weights[key] = (weights[key] ?? 1) * factor;
}

function applyAskFactorWeights(
  weights: Partial<Record<KbHotelGuideScoreFactorKey, number>>,
  ask: string,
): void {
  const q = ask.toLowerCase();
  if (/\bfamil\w*|\bkids?\b|\bchildren\b|\bteen/i.test(q)) {
    bump(weights, "family", 2.2);
    bump(weights, "rooms", 1.5);
    bump(weights, "service", 1.35);
    bump(weights, "views_and_privacy", 0.75);
  }
  if (/\bhoneymoon\b|\bromantic\b|\bcouples?\b/i.test(q)) {
    bump(weights, "views_and_privacy", 1.6);
    bump(weights, "character", 1.35);
    bump(weights, "wellness", 1.3);
    bump(weights, "family", 0.5);
  }
  if (/\bspa\b|\bwellness\b|\bonsen\b/i.test(q)) {
    bump(weights, "wellness", 1.8);
    bump(weights, "service", 1.2);
  }
  if (/\bbusiness\b|\bmeeting\b|\bwork\b/i.test(q)) {
    bump(weights, "access", 1.6);
    bump(weights, "support", 1.4);
    bump(weights, "consistency", 1.3);
  }
  if (/\bquiet\b|\bcalm\b|\bpeaceful\b/i.test(q)) {
    bump(weights, "neighbourhood", 1.5);
    bump(weights, "character", 1.3);
  }
  if (/\bview\b|\bprivacy\b|\bocean\b|\bfuji\b/i.test(q)) {
    bump(weights, "views_and_privacy", 1.6);
  }
  if (/\bfood\b|\bdining\b|\brestaurant\b|\bculinary\b/i.test(q)) {
    bump(weights, "food_and_beverage", 1.7);
  }
  if (/\bindian\b|\bjain\b|\bvegetarian\b|\bveg\b|\bpescatarian\b/i.test(q)) {
    bump(weights, "indian_client_fit", 1.8);
    bump(weights, "food_and_beverage", 1.4);
  }
  if (/\bsolo\b/i.test(q)) {
    bump(weights, "access", 1.35);
    bump(weights, "neighbourhood", 1.25);
    bump(weights, "family", 0.45);
  }
}

function applyPrefFactorWeights(
  weights: Partial<Record<KbHotelGuideScoreFactorKey, number>>,
  prefHints: string[],
): void {
  for (const raw of prefHints) {
    const label = raw.trim().toLowerCase();
    if (!label) continue;
    const avoid = label.startsWith("avoid:");
    const text = avoid ? label.slice(6).trim() : label;
    const mult = avoid ? 0.55 : 1.55;
    if (/famil|kids?|children|connecting|interconnecting/.test(text)) {
      bump(weights, "family", mult);
      bump(weights, "rooms", avoid ? 0.7 : 1.4);
    }
    if (/quiet|calm|peaceful|noise/.test(text)) {
      bump(weights, "neighbourhood", mult);
      bump(weights, "character", avoid ? 0.75 : 1.25);
    }
    if (/spa|wellness|onsen/.test(text)) {
      bump(weights, "wellness", mult);
    }
    if (/view|privacy|ocean|beach/.test(text)) {
      bump(weights, "views_and_privacy", mult);
    }
    if (
      /food|dining|vegetarian|jain|pescatarian|vegan|diet|halal|kosher/.test(text)
    ) {
      bump(weights, "food_and_beverage", mult);
      if (/indian|jain|vegetarian|veg|pescatarian/.test(text)) {
        bump(weights, "indian_client_fit", mult);
      }
    }
    if (/service|butler|attentive/.test(text)) {
      bump(weights, "service", mult);
      bump(weights, "support", avoid ? 0.75 : 1.25);
    }
    if (/nightlife|party|club/.test(text) && avoid) {
      bump(weights, "neighbourhood", 1.35);
      bump(weights, "character", 1.2);
    }
  }
}

function partyFactorWeights(
  ctx?: HotelSuggestParty | null,
): Partial<Record<KbHotelGuideScoreFactorKey, number>> {
  const adults = typeof ctx?.adults === "number" ? ctx.adults : null;
  const children = typeof ctx?.children === "number" ? ctx.children : null;
  const weights: Partial<Record<KbHotelGuideScoreFactorKey, number>> = {};
  for (const key of KB_HOTEL_GUIDE_SCORE_FACTOR_KEYS) {
    weights[key] = 1;
  }
  if (children != null && children > 0) {
    weights.family = 2.5;
    weights.rooms = 1.8;
    weights.service = 1.6;
    weights.support = 1.5;
    weights.food_and_beverage = 1.3;
    weights.views_and_privacy = 0.7;
    weights.character = 0.85;
  } else if (adults === 1) {
    weights.access = 1.4;
    weights.neighbourhood = 1.3;
    weights.family = 0.4;
  } else if (adults != null && adults >= 3) {
    weights.rooms = 1.6;
    weights.family = 1.4;
    weights.support = 1.3;
  } else if (adults === 2) {
    weights.views_and_privacy = 1.45;
    weights.character = 1.3;
    weights.wellness = 1.25;
    weights.family = 0.55;
  }

  const ask = ctx?.ask?.trim();
  if (ask) applyAskFactorWeights(weights, ask);

  const prefs = (ctx?.prefHints ?? []).filter(Boolean);
  if (prefs.length > 0) applyPrefFactorWeights(weights, prefs);

  // Ask "family" without trip kids still tilts family when party unset.
  if (
    (children == null || children === 0) &&
    ask &&
    /\bfamil\w*|\bkids?\b|\bchildren\b/i.test(ask) &&
    !/\bhoneymoon\b/i.test(ask)
  ) {
    bump(weights, "family", 1.35);
  }

  return weights;
}

/**
 * Weighted average of matrix factors (1–5). Null when no scored factors.
 * Party + ask + client prefs tilt weights behind the scenes.
 */
export function matrixFitScore(
  factors: KbHotelGuideScoreFactors | null | undefined,
  party?: HotelSuggestParty | null,
): number | null {
  if (!factors || Object.keys(factors).length === 0) return null;
  const weights = partyFactorWeights(party);
  let sum = 0;
  let weightSum = 0;
  for (const key of KB_HOTEL_GUIDE_SCORE_FACTOR_KEYS) {
    const value = factors[key];
    if (value == null || !Number.isFinite(value)) continue;
    const weight = weights[key] ?? 1;
    sum += value * weight;
    weightSum += weight;
  }
  if (weightSum <= 0) return null;
  return sum / weightSum;
}

/**
 * Behind-the-scenes quality for ranking: ~40% guide average + 60% matrix fit
 * when both exist; falls back to whichever is present.
 */
export function guideQualityScore(
  hit: Pick<KbHotelSuggestHit, "guide_score" | "guide_score_factors">,
  party?: HotelSuggestParty | null,
): number {
  const average = hit.guide_score;
  const fit = matrixFitScore(hit.guide_score_factors, party);
  if (average != null && Number.isFinite(average) && fit != null) {
    return average * 0.4 + fit * 0.6;
  }
  if (fit != null) return fit;
  if (average != null && Number.isFinite(average)) return average;
  return 0;
}

/** Drop honeymoon/couples-only choose-if when ranking for a family party/ask. */
export function softChooseIfForParty(
  chooseIf: string | null | undefined,
  party?: HotelSuggestParty | null,
): string | null {
  const text = chooseIf?.trim() || null;
  if (!text) return null;
  const kids = typeof party?.children === "number" ? party.children : 0;
  const askFamily =
    party?.ask &&
    /\bfamil\w*|\bkids?\b|\bchildren\b/i.test(party.ask) &&
    !/\bhoneymoon\b/i.test(party.ask);
  if (
    (kids > 0 || askFamily) &&
    /\bhoneymoon\b|\bcouples?\b/i.test(text) &&
    !/\bfamil\w*|\bkids?\b|\bchildren\b/i.test(text)
  ) {
    return null;
  }
  return text;
}

/** Rank: linked/shoppable → higher luxury band → guide quality (avg + matrix) → place → name. */
export function compareKbHotelSuggestHits(
  a: KbHotelSuggestHit,
  b: KbHotelSuggestHit,
  party?: HotelSuggestParty | null,
): number {
  const linked = Number(Boolean(b.property_id)) - Number(Boolean(a.property_id));
  if (linked !== 0) return linked;
  const tier =
    (b.luxury_band ? HOTEL_PRICE_TIER_RANK[b.luxury_band] : 0) -
    (a.luxury_band ? HOTEL_PRICE_TIER_RANK[a.luxury_band] : 0);
  if (tier !== 0) return tier;
  const quality = guideQualityScore(b, party) - guideQualityScore(a, party);
  if (quality !== 0) return quality;
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
  party?: HotelSuggestParty | null,
): Promise<KbHotelSuggestHit[]> {
  const hits: KbHotelSuggestHit[] = [];
  const seen = new Set<string>();
  // Fetch a buffer so quality sort (tier / guide + matrix) can beat alphabetical order.
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

  return softHits(hits, party).slice(0, limit);
}

/** Soften choose_if + rank with matrix context. */
function softHits(
  hits: KbHotelSuggestHit[],
  party?: HotelSuggestParty | null,
): KbHotelSuggestHit[] {
  return hits
    .map((hit) => ({
      ...hit,
      choose_if: softChooseIfForParty(hit.choose_if, party),
    }))
    .sort((a, b) => compareKbHotelSuggestHits(a, b, party));
}

/**
 * Preferred Atlas hotels for a city or country name (e.g. Kyoto, Japan).
 * Excludes placeholders and the Unspecified city bucket.
 * Ranked by linked → luxury band → guide quality (avg + matrix fit) — not A–Z.
 */
export async function listKbHotelsForPlaceSuggest(input: {
  place: string;
  limit?: number;
  /** Trip party / ask / prefs — tilts matrix weights. */
  party?: HotelSuggestParty | null;
}): Promise<KbHotelSuggestHit[]> {
  const place = input.place.trim();
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 20);
  if (place.length < 2) return [];

  const cities = await findCitiesByName(place);
  if (cities.length > 0) {
    return hotelsForCityIds(cities, place, limit, input.party);
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

  return hotelsForCityIds(asRows, place, limit, input.party);
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
  party?: HotelSuggestParty | null;
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

  return softHits(hits, input.party).slice(0, limit);
}
