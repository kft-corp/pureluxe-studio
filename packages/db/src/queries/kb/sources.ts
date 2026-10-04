/**
 * Sources Tracker rows (Settings). Scrape jobs loop active sources.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { KbSource, KbSourceType } from "../../schema";

export async function listKbSources(input?: {
  active_only?: boolean;
}): Promise<KbSource[]> {
  const supabase = getServiceClient();

  let query = supabase
    .from("kb_sources")
    .select("*")
    .order("name", { ascending: true });

  if (input?.active_only) {
    query = query.eq("active", true);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbSource[];
}

export async function findKbSourceById(
  sourceId: string,
): Promise<KbSource | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("kb_sources").select("*").eq("id", sourceId).maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbSource | null;
}

export type InsertKbSourceInput = {
  name: string;
  source_type?: KbSourceType;
  url?: string | null;
  fetch_method?: string | null;
  terms_notes?: string | null;
  metadata?: Record<string, unknown>;
  active?: boolean;
};

export async function insertKbSource(
  input: InsertKbSourceInput,
): Promise<KbSource> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_sources")
      .insert({
        name: input.name.trim(),
        source_type: input.source_type ?? "website",
        url: input.url ?? null,
        fetch_method: input.fetch_method ?? null,
        terms_notes: input.terms_notes ?? null,
        metadata: input.metadata ?? {},
        active: input.active ?? true,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbSource;
}

export type UpdateKbSourceInput = {
  id: string;
  name?: string;
  source_type?: KbSourceType;
  url?: string | null;
  fetch_method?: string | null;
  terms_notes?: string | null;
  metadata?: Record<string, unknown>;
  active?: boolean;
};

export async function updateKbSource(
  input: UpdateKbSourceInput,
): Promise<KbSource | null> {
  const { id, ...rest } = input;
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      patch[key] =
        key === "name" && typeof value === "string" ? value.trim() : value;
    }
  }

  if (Object.keys(patch).length === 0) {
    return findKbSourceById(id);
  }

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_sources")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as KbSource | null;
}
