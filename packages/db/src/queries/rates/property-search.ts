import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import { escapeIlike } from "../../utils/ilike";
import type {
  HotelPriceTier,
  PropertyPriceBand,
  PropertySearchHit,
} from "../../schema";

const TIERS = new Set<HotelPriceTier>(["ultra_luxury", "luxury", "premium"]);

function asTier(value: string | null | undefined): HotelPriceTier | null {
  if (!value || !TIERS.has(value as HotelPriceTier)) return null;
  return value as HotelPriceTier;
}

function asHit(row: Record<string, unknown>): PropertySearchHit {
  return {
    id: String(row.id),
    name: String(row.name),
    destination: (row.destination as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    score: Number(row.score ?? 0),
    aliases: Array.isArray(row.aliases) ? (row.aliases as string[]) : [],
    price_tier: asTier(row.price_tier as string | null),
    style_tags: Array.isArray(row.style_tags) ? (row.style_tags as string[]) : [],
  };
}

/** Ranked active hotels by name or alias (search_properties RPC). */
export async function searchPropertiesRanked(input: {
  query: string;
  destination?: string | null;
  limit?: number;
}): Promise<PropertySearchHit[]> {
  const query = input.query.trim();
  if (query.length < 2) return [];

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase.rpc("search_properties", {
      q: query,
      dest: input.destination?.trim() || null,
      lim: input.limit ?? 8,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(asHit);
}

type KbHotelEmbed = {
  property_id: string | null;
  kb_hotel_details:
    | { price_tier: string | null; style_tags: string[] | null }
    | { price_tier: string | null; style_tags: string[] | null }[]
    | null;
};

function detailsOf(
  row: KbHotelEmbed,
): { price_tier: HotelPriceTier | null; style_tags: string[] } {
  const raw = row.kb_hotel_details;
  const details = Array.isArray(raw) ? raw[0] : raw;
  return {
    price_tier: asTier(details?.price_tier ?? null),
    style_tags: Array.isArray(details?.style_tags) ? details!.style_tags! : [],
  };
}

/** Atlas tier and style tags for Rate Layer hotels (linked kb_entities). */
export async function listHotelDetailsByPropertyIds(
  propertyIds: string[],
): Promise<Map<string, { price_tier: HotelPriceTier | null; style_tags: string[] }>> {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  const out = new Map<string, { price_tier: HotelPriceTier | null; style_tags: string[] }>();
  if (ids.length === 0) return out;

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("property_id, kb_hotel_details(price_tier, style_tags)")
      .eq("entity_type", "hotel")
      .eq("active", true)
      .in("property_id", ids),
  );

  if (error) {
    throw dbQueryError(error);
  }

  for (const row of (data ?? []) as KbHotelEmbed[]) {
    if (!row.property_id) continue;
    out.set(row.property_id, detailsOf(row));
  }
  return out;
}

/** Active PureLuxe hotels in a destination, optionally filtered by tier. */
export async function listActiveHotelsInDestination(input: {
  destination: string;
  tier?: HotelPriceTier | null;
  excludePropertyIds?: string[];
  limit?: number;
}): Promise<PropertySearchHit[]> {
  const dest = input.destination.trim();
  if (dest.length < 2) return [];

  const supabase = getServiceClient();
  const pattern = `%${escapeIlike(dest)}%`;
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("properties")
      .select("id, name, destination, city, country, aliases")
      .eq("active", true)
      .or(`destination.ilike.${pattern},country.ilike.${pattern},city.ilike.${pattern}`)
      .order("name", { ascending: true })
      .limit(40),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    destination: string | null;
    city: string | null;
    country: string | null;
    aliases: string[] | null;
  }>;

  const exclude = new Set(input.excludePropertyIds ?? []);
  const details = await listHotelDetailsByPropertyIds(rows.map((row) => row.id));
  const needle = dest.toLowerCase();

  const hits = rows
    .filter((row) => !exclude.has(row.id))
    .map((row) => {
      const meta = details.get(row.id) ?? { price_tier: null, style_tags: [] as string[] };
      const place = `${row.destination ?? ""} ${row.country ?? ""} ${row.city ?? ""}`.toLowerCase();
      const exactPlace =
        (row.destination ?? "").toLowerCase() === needle ||
        (row.country ?? "").toLowerCase() === needle ||
        (row.city ?? "").toLowerCase() === needle;
      return {
        id: row.id,
        name: row.name,
        destination: row.destination,
        city: row.city,
        country: row.country,
        score: exactPlace ? 1 : place.includes(needle) ? 0.8 : 0.5,
        aliases: row.aliases ?? [],
        price_tier: meta.price_tier,
        style_tags: meta.style_tags,
      } satisfies PropertySearchHit;
    })
    .filter((hit) => !input.tier || hit.price_tier === input.tier)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return hits.slice(0, input.limit ?? 8);
}

/** Price bands for one or more hotels. */
export async function listPropertyPriceBands(
  propertyIds: string[],
): Promise<PropertyPriceBand[]> {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("property_price_bands").select("*").in("property_id", ids),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as PropertyPriceBand[];
}

/** Typical nightly across seasons for a hotel (median of season medians). */
export function typicalNightlyForProperty(
  bands: PropertyPriceBand[],
  propertyId: string,
): number | null {
  const rows = bands.filter((band) => band.property_id === propertyId);
  if (rows.length === 0) return null;
  const values = rows.map((band) => Number(band.typical_nightly)).filter((n) => Number.isFinite(n));
  if (values.length === 0) return null;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!;
}

/**
 * Set Atlas price_tier for a Rate Layer hotel (Hotels-sheet import).
 * Returns false when no linked kb hotel details row exists.
 */
export async function updateHotelPriceTierByPropertyId(input: {
  propertyId: string;
  priceTier: HotelPriceTier | null;
}): Promise<boolean> {
  const supabase = getServiceClient();
  const { data: entity, error: findError } = await runSupabaseQuery(() =>
    supabase
      .from("kb_entities")
      .select("id")
      .eq("property_id", input.propertyId)
      .eq("entity_type", "hotel")
      .eq("active", true)
      .maybeSingle(),
  );

  if (findError) {
    throw dbQueryError(findError);
  }
  if (!entity?.id) return false;

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_hotel_details")
      .update({ price_tier: input.priceTier })
      .eq("entity_id", entity.id),
  );

  if (error) {
    throw dbQueryError(error);
  }
  return true;
}

/** Replace property aliases (Hotels-sheet / ops import). */
export async function updatePropertyAliases(input: {
  propertyId: string;
  aliases: string[];
}): Promise<void> {
  const supabase = getServiceClient();
  const aliases = [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))];
  const { error } = await runSupabaseQuery(() =>
    supabase.from("properties").update({ aliases }).eq("id", input.propertyId),
  );
  if (error) {
    throw dbQueryError(error);
  }
}
