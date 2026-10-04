/**
 * Atlas KB entity queries (hotels / restaurants / activities / vendors).
 *
 * Used by resolveCandidates, typeahead, and GET entity.
 * Ranking cap and studio/guest stripping live in @pureluxe/kb — not here.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  KbContractStatus,
  KbEntity,
  KbEntityType,
  KbTier,
} from "../../schema";
import { escapeIlike } from "../../utils/ilike";

const KB_TIER_RANK: Record<KbTier, number> = {
  kb_verified: 0,
  kb_scraped: 1,
  llm_general: 2,
};

/** Sort for resolve: tier first, then advisor_take, property link, name. */
export function compareKbEntitiesForResolve(a: KbEntity, b: KbEntity): number {
  const tierDiff = KB_TIER_RANK[a.kb_tier] - KB_TIER_RANK[b.kb_tier];
  if (tierDiff !== 0) return tierDiff;

  const aTake = a.advisor_take ? 0 : 1;
  const bTake = b.advisor_take ? 0 : 1;
  if (aTake !== bTake) return aTake - bTake;

  const aProp = a.property_id ? 0 : 1;
  const bProp = b.property_id ? 0 : 1;
  if (aProp !== bProp) return aProp - bProp;

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export type ListKbEntitiesInput = {
  q?: string | null;
  city_id?: string | null;
  country_id?: string | null;
  country_code?: string | null;
  entity_type?: KbEntityType | null;
  kb_tier?: KbTier | null;
  /** Default false — hide dummy rows from resolve / client lists. */
  include_placeholders?: boolean;
  /** Default false — hide Aman-style not_yet_contracted from bookable lists. */
  include_not_yet_contracted?: boolean;
  /** Soft fetch ceiling before package-level cap (default 40). */
  limit?: number;
};

async function resolveCountryIdFromCode(
  countryCode: string,
): Promise<string | null> {
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

/** Active hotel linked to a Rate Layer property (paste / rates path). */
export async function findActiveKbEntityByPropertyId(
  propertyId: string,
): Promise<KbEntity | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("*")
      .eq("property_id", propertyId)
      .eq("active", true)
      .eq("entity_type", "hotel")
      .limit(10),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const rows = ((data ?? []) as KbEntity[]).sort(compareKbEntitiesForResolve);
  return rows[0] ?? null;
}

/**
 * Second identity path (§3.4): match jsonb external_ids key (e.g. sabre_hotel_id).
 * Prefer exact containment; returns first active hit.
 */
export async function findActiveKbEntityByExternalId(input: {
  key: string;
  value: string;
}): Promise<KbEntity | null> {
  const key = input.key.trim();
  const value = input.value.trim();
  if (!key || !value) return null;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("*")
      .eq("active", true)
      .contains("external_ids", { [key]: value })
      .limit(1)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbEntity | null;
}

/** Active entity by id (null if missing or inactive). */
export async function findActiveKbEntityById(
  entityId: string,
): Promise<KbEntity | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("*")
      .eq("id", entityId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbEntity | null;
}

/** Entity by id including inactive (ops edit). */
export async function findKbEntityById(
  entityId: string,
): Promise<KbEntity | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("kb_entities").select("*").eq("id", entityId).maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbEntity | null;
}

/**
 * Dedup identity: entity_type + city_id + lower(name) among active rows.
 * Used before scrape/manual insert (§3.4).
 */
export async function findActiveKbEntityByIdentity(input: {
  entity_type: KbEntityType;
  city_id: string;
  name: string;
}): Promise<KbEntity | null> {
  const name = input.name.trim();
  if (!name) return null;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("*")
      .eq("entity_type", input.entity_type)
      .eq("city_id", input.city_id)
      .eq("active", true)
      .ilike("name", name)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbEntity | null;
}

/**
 * List / filter entities for resolve and GET /entities.
 * Country-only without city_id requires `q` (typeahead). Without `q`, returns
 * [] so callers cannot accidentally dump every hotel in a country (§3.1).
 */
export async function listActiveKbEntities(
  input: ListKbEntitiesInput = {},
): Promise<KbEntity[]> {
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const supabase = getServiceClient();

  let countryId = input.country_id ?? null;
  if (!countryId && input.country_code) {
    countryId = await resolveCountryIdFromCode(input.country_code);
    if (!countryId) return [];
  }

  const q = input.q?.trim() ?? null;
  const hasCity = Boolean(input.city_id);
  if (!hasCity && countryId && !q) {
    return [];
  }

  let query = supabase
    .from("kb_entities")
    .select("*")
    .eq("active", true)
    .limit(limit);

  if (input.city_id) {
    query = query.eq("city_id", input.city_id);
  } else if (countryId) {
    query = query.eq("country_id", countryId);
  }

  if (input.entity_type) {
    query = query.eq("entity_type", input.entity_type);
  }
  if (input.kb_tier) {
    query = query.eq("kb_tier", input.kb_tier);
  }
  if (!input.include_placeholders) {
    query = query.eq("placeholder", false);
  }
  if (!input.include_not_yet_contracted) {
    query = query.neq("contract_status", "not_yet_contracted");
  }

  if (q) {
    const pattern = `%${escapeIlike(q)}%`.replaceAll('"', '\\"');
    query = query.or(
      [
        `name.ilike."${pattern}"`,
        `brand.ilike."${pattern}"`,
        `description.ilike."${pattern}"`,
      ].join(","),
    );
  }

  query = query.order("name", { ascending: true });

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as KbEntity[];
  return rows.sort(compareKbEntitiesForResolve);
}

/**
 * Resolve hotels for one city — single round-trip, tier-sorted.
 * Cap (default 5) is applied here as a hard SQL/fetch bound; @pureluxe/kb may
 * re-order within the list but should not request more without raising limit.
 */
export async function listKbHotelCandidatesForCity(input: {
  city_id: string;
  limit?: number;
  include_placeholders?: boolean;
  include_not_yet_contracted?: boolean;
}): Promise<KbEntity[]> {
  const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);

  // Fetch a small buffer so in-memory tier sort still fills the cap.
  const buffer = await listActiveKbEntities({
    city_id: input.city_id,
    entity_type: "hotel",
    include_placeholders: input.include_placeholders ?? false,
    include_not_yet_contracted: input.include_not_yet_contracted ?? false,
    limit: Math.min(limit * 4, 40),
  });

  return buffer.slice(0, limit);
}

export type InsertKbEntityInput = {
  entity_type: KbEntityType;
  name: string;
  brand?: string | null;
  description?: string | null;
  advisor_take?: string | null;
  advisor_take_updated_by_id?: string | null;
  kb_tier?: KbTier;
  provenance?: KbEntity["provenance"];
  source_id?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  region_id?: string | null;
  country_id?: string | null;
  city_id?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website_url?: string | null;
  destination_profile_id?: string | null;
  property_id?: string | null;
  contract_status?: KbContractStatus;
  client_ready?: boolean;
  placeholder?: boolean;
  not_yet_open?: boolean;
  external_ids?: Record<string, unknown>;
  legacy_notes?: string | null;
  active?: boolean;
};

/**
 * Insert entity. Caller must SET LOCAL kb.writer_kind = 'human' when
 * advisor_take is set (DB trigger). Prefer leaving advisor_take null from jobs.
 */
export async function insertKbEntity(
  input: InsertKbEntityInput,
): Promise<KbEntity> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .insert({
        entity_type: input.entity_type,
        name: input.name.trim(),
        brand: input.brand ?? null,
        description: input.description ?? null,
        advisor_take: input.advisor_take ?? null,
        advisor_take_updated_by_id: input.advisor_take_updated_by_id ?? null,
        kb_tier: input.kb_tier ?? "kb_scraped",
        provenance: input.provenance ?? "kb",
        source_id: input.source_id ?? null,
        source_name: input.source_name ?? null,
        source_url: input.source_url ?? null,
        region_id: input.region_id ?? null,
        country_id: input.country_id ?? null,
        city_id: input.city_id ?? null,
        address_line_1: input.address_line_1 ?? null,
        address_line_2: input.address_line_2 ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        website_url: input.website_url ?? null,
        destination_profile_id: input.destination_profile_id ?? null,
        property_id: input.property_id ?? null,
        contract_status: input.contract_status ?? "unknown",
        client_ready: input.client_ready ?? false,
        placeholder: input.placeholder ?? false,
        not_yet_open: input.not_yet_open ?? false,
        external_ids: input.external_ids ?? {},
        legacy_notes: input.legacy_notes ?? null,
        active: input.active ?? true,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbEntity;
}

export type UpdateKbEntityInput = {
  id: string;
  name?: string;
  brand?: string | null;
  description?: string | null;
  advisor_take?: string | null;
  advisor_take_updated_by_id?: string | null;
  kb_tier?: KbTier;
  provenance?: KbEntity["provenance"];
  source_id?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  region_id?: string | null;
  country_id?: string | null;
  city_id?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  website_url?: string | null;
  destination_profile_id?: string | null;
  property_id?: string | null;
  contract_status?: KbContractStatus;
  client_ready?: boolean;
  placeholder?: boolean;
  not_yet_open?: boolean;
  external_ids?: Record<string, unknown>;
  legacy_notes?: string | null;
  active?: boolean;
  verified_by_id?: string | null;
  verified_at?: string | null;
};

/** Patch entity fields. advisor_take changes require human writer flag. */
export async function updateKbEntity(
  input: UpdateKbEntityInput,
): Promise<KbEntity | null> {
  const { id, ...rest } = input;
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      patch[key] = key === "name" && typeof value === "string" ? value.trim() : value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return findKbEntityById(id);
  }

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbEntity | null;
}

/** Promote to kb_verified. Does not touch advisor_take. */
export async function verifyKbEntity(input: {
  entity_id: string;
  verified_by_id: string;
}): Promise<KbEntity | null> {
  return updateKbEntity({
    id: input.entity_id,
    kb_tier: "kb_verified",
    verified_by_id: input.verified_by_id,
    verified_at: new Date().toISOString(),
  });
}

/**
 * Soft-deactivate stale llm_general rows (daily cron, TTL from settings).
 * Never hard-deletes; never touches kb_verified / kb_scraped.
 */
export async function listExpiredLlmGeneralKbEntities(
  ttlDays: number,
  limit = 200,
): Promise<KbEntity[]> {
  const days = Math.max(1, Math.floor(ttlDays));
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("*")
      .eq("active", true)
      .eq("kb_tier", "llm_general")
      .lt("updated_at", cutoff.toISOString())
      .order("updated_at", { ascending: true })
      .limit(Math.min(Math.max(limit, 1), 500)),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbEntity[];
}

/** Soft-deactivate entities by id (prefer over delete). */
export async function deactivateKbEntities(
  entityIds: string[],
): Promise<number> {
  if (entityIds.length === 0) return 0;

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .update({ active: false })
      .in("id", entityIds)
      .select("id"),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []).length;
}
