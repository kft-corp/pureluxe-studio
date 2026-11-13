/**
 * Atlas experience shortlists (activities + restaurants) for Trip Builder.
 * Content plane only — pairs with hotel_find and place_get_notes.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { KbEntity } from "../../schema";

import { findKbActivityDetails, findKbRestaurantDetails } from "./entity-details";
import { listActiveKbCountries, listActiveKbCitiesForCountry } from "./places";
import { listActiveKbEntities } from "./entities";

export type KbExperienceKind = "activity" | "restaurant";

export type KbExperienceSuggestHit = {
  kind: KbExperienceKind;
  name: string;
  city: string | null;
  /** Guide type label (e.g. Experience, Restaurant). */
  guide_type: string | null;
  /** Who it suits from the destination guide. */
  who_it_suits: string | null;
  /** Booking lead time when known. */
  lead_time: string | null;
  /** Dietary / veg-Jain note when present. */
  veg_jain: string | null;
  /** One-line why from description. */
  why: string | null;
};

export type ListKbExperiencesForPlaceSuggestInput = {
  place: string;
  activityLimit?: number;
  restaurantLimit?: number;
  /** Prefer family / kids-friendly who_it_suits. */
  preferFamily?: boolean;
  /** Prefer couples / honeymoon / adults romantic. */
  preferCouples?: boolean;
  /** Prefer veg / Jain friendly notes. */
  preferVeg?: boolean;
  /** Prefer entries that need booking (lead time not walk-in). */
  preferBookAhead?: boolean;
};

type CityRow = {
  id: string;
  name: string;
  country_id: string;
  kb_countries: { name: string; country_code: string } | null;
};

type ExperienceMeta = {
  guide_type: string | null;
  who_it_suits: string | null;
  lead_time: string | null;
  veg_jain: string | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function firstSentence(text: string | null | undefined, max = 140): string | null {
  const cleaned = text?.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const cut = cleaned.split(/(?<=[.!?])\s+/)[0] ?? cleaned;
  if (cut.length <= max) return cut;
  return `${cut.slice(0, max - 1).trim()}…`;
}

function strId(ids: Record<string, unknown>, key: string): string | null {
  const raw = ids[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickMeta(
  typed: {
    guide_type?: string | null;
    who_it_suits?: string | null;
    lead_time?: string | null;
    veg_jain_notes?: string | null;
  } | null,
  ids: Record<string, unknown>,
): ExperienceMeta {
  return {
    guide_type: typed?.guide_type?.trim() || strId(ids, "guide_type"),
    who_it_suits: typed?.who_it_suits?.trim() || strId(ids, "who_it_suits"),
    lead_time: typed?.lead_time?.trim() || strId(ids, "lead_time"),
    veg_jain: typed?.veg_jain_notes?.trim() || strId(ids, "veg_jain"),
  };
}

function toHit(
  entity: KbEntity,
  cityName: string | null,
  meta: ExperienceMeta,
): KbExperienceSuggestHit {
  const kind: KbExperienceKind =
    entity.entity_type === "restaurant" ? "restaurant" : "activity";
  return {
    kind,
    name: entity.name,
    city: cityName,
    guide_type: meta.guide_type,
    who_it_suits: meta.who_it_suits,
    lead_time: meta.lead_time,
    veg_jain: meta.veg_jain,
    why: firstSentence(entity.description, 140),
  };
}

function scoreHit(
  hit: KbExperienceSuggestHit,
  input: ListKbExperiencesForPlaceSuggestInput,
): number {
  let score = 0;
  const who = (hit.who_it_suits ?? "").toLowerCase();
  const veg = (hit.veg_jain ?? "").toLowerCase();
  const lead = (hit.lead_time ?? "").toLowerCase();
  if (input.preferFamily && /famil|kids|children|all/i.test(who)) score += 20;
  if (input.preferCouples && /couple|honeymoon|adults|romantic/i.test(who)) {
    score += 20;
  }
  if (input.preferVeg) {
    if (/jain/i.test(veg) && !/not jain|unchecked|not for/i.test(veg)) score += 30;
    else if (/veg/i.test(veg) && !/not for vegetar|not suited|non-veg/i.test(veg)) {
      score += 25;
    } else if (/n\/a|not checked/i.test(veg)) score -= 5;
  }
  if (input.preferBookAhead) {
    if (lead && !/none|walk-in|n\/a/i.test(lead)) score += 15;
  }
  if (hit.why) score += 2;
  if (lead.includes("none") || lead.includes("walk-in")) score -= 1;
  return score;
}

function compareExperiences(
  a: KbExperienceSuggestHit,
  b: KbExperienceSuggestHit,
  input: ListKbExperiencesForPlaceSuggestInput,
): number {
  const scoreDiff = scoreHit(b, input) - scoreHit(a, input);
  if (scoreDiff !== 0) return scoreDiff;
  const aLead = (a.lead_time ?? "").toLowerCase();
  const bLead = (b.lead_time ?? "").toLowerCase();
  const aWalk = aLead.includes("none") || aLead.includes("walk-in") ? 1 : 0;
  const bWalk = bLead.includes("none") || bLead.includes("walk-in") ? 1 : 0;
  if (aWalk !== bWalk) return aWalk - bWalk;
  const aWhy = a.why ? 0 : 1;
  const bWhy = b.why ? 0 : 1;
  if (aWhy !== bWhy) return aWhy - bWhy;
  return a.name.localeCompare(b.name);
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

async function enrichHits(
  entities: KbEntity[],
  cityName: string,
  kind: KbExperienceKind,
): Promise<KbExperienceSuggestHit[]> {
  return Promise.all(
    entities.map(async (entity) => {
      const ids = entity.external_ids ?? {};
      const details =
        kind === "restaurant"
          ? await findKbRestaurantDetails(entity.id)
          : await findKbActivityDetails(entity.id);
      return toHit(entity, cityName, pickMeta(details, ids));
    }),
  );
}

async function experiencesForCity(
  city: CityRow,
  activityLimit: number,
  restaurantLimit: number,
  input: ListKbExperiencesForPlaceSuggestInput,
): Promise<KbExperienceSuggestHit[]> {
  const [activities, restaurants] = await Promise.all([
    activityLimit > 0
      ? listActiveKbEntities({
          city_id: city.id,
          entity_type: "activity",
          include_placeholders: false,
          include_not_yet_contracted: true,
          limit: Math.min(Math.max(activityLimit * 4, 12), 40),
        })
      : Promise.resolve([] as KbEntity[]),
    restaurantLimit > 0
      ? listActiveKbEntities({
          city_id: city.id,
          entity_type: "restaurant",
          include_placeholders: false,
          include_not_yet_contracted: true,
          limit: Math.min(Math.max(restaurantLimit * 4, 12), 40),
        })
      : Promise.resolve([] as KbEntity[]),
  ]);

  const [activityHits, restaurantHits] = await Promise.all([
    enrichHits(activities, city.name, "activity"),
    enrichHits(restaurants, city.name, "restaurant"),
  ]);

  return [
    ...activityHits
      .sort((a, b) => compareExperiences(a, b, input))
      .slice(0, activityLimit),
    ...restaurantHits
      .sort((a, b) => compareExperiences(a, b, input))
      .slice(0, restaurantLimit),
  ];
}

/**
 * Curated activities + restaurants for a city (or first matching city in a country).
 * Country-level asks pick the best-known spine city with any experiences — never dumps every city.
 */
export async function listKbExperiencesForPlaceSuggest(
  input: ListKbExperiencesForPlaceSuggestInput,
): Promise<KbExperienceSuggestHit[]> {
  const place = input.place.trim();
  const activityLimit = Math.min(Math.max(input.activityLimit ?? 3, 0), 8);
  const restaurantLimit = Math.min(Math.max(input.restaurantLimit ?? 2, 0), 6);
  if (place.length < 2 || (activityLimit === 0 && restaurantLimit === 0)) {
    return [];
  }

  const cities = await findCitiesByName(place);
  if (cities.length > 0) {
    const ordered = [...cities].sort(
      (a, b) => Number(norm(b.name) === norm(place)) - Number(norm(a.name) === norm(place)),
    );
    for (const city of ordered) {
      const hits = await experiencesForCity(
        city,
        activityLimit,
        restaurantLimit,
        input,
      );
      if (hits.length > 0) return hits;
    }
    return [];
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
  const spineOrder = ["tokyo", "kyoto", "osaka", "hakone", "niseko"];
  const ranked = [...countryCities].sort((a, b) => {
    const ai = spineOrder.indexOf(norm(a.name));
    const bi = spineOrder.indexOf(norm(b.name));
    const aRank = ai === -1 ? 99 : ai;
    const bRank = bi === -1 ? 99 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });

  for (const row of ranked) {
    const city: CityRow = {
      id: row.id,
      name: row.name,
      country_id: row.country_id,
      kb_countries: { name: country.name, country_code: country.country_code },
    };
    const hits = await experiencesForCity(
      city,
      activityLimit,
      restaurantLimit,
      input,
    );
    if (hits.length > 0) return hits;
  }

  return [];
}
