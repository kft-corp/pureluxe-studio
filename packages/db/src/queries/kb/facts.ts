/**
 * Long-form facts + chunks (KB-R1 keyword search). No embeddings here.
 * Never used to pick a rate source or supplier.
 */
import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { KbEntity, KbFact, KbFactChunk } from "../../schema";
import { escapeIlike } from "../../utils/ilike";
import { listActiveKbEntities } from "./entities";

/** Approved facts for one entity (chat / honeymoon question). */
export async function listApprovedKbFactsForEntity(
  entityId: string,
): Promise<KbFact[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_facts")
      .select("*")
      .eq("entity_id", entityId)
      .eq("status", "approved")
      .order("updated_at", { ascending: false }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbFact[];
}

/** Chunks for one fact (rebuild / debug). */
export async function listKbFactChunksForFact(
  factId: string,
): Promise<KbFactChunk[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("kb_fact_chunks")
      .select("*")
      .eq("fact_id", factId)
      .order("chunk_index", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbFactChunk[];
}

export type SearchKbFactsInput = {
  q: string;
  entity_id?: string | null;
  limit?: number;
};

/**
 * KB-R1: keyword search on approved fact body (trigram index).
 * Never used to pick a rate source.
 */
export async function searchApprovedKbFacts(
  input: SearchKbFactsInput,
): Promise<KbFact[]> {
  const q = input.q.trim();
  if (!q) return [];

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const pattern = `%${escapeIlike(q)}%`.replaceAll('"', '\\"');
  const supabase = getServiceClient();

  let query = supabase
    .from("kb_facts")
    .select("*")
    .eq("status", "approved")
    .or(`title.ilike."${pattern}",body.ilike."${pattern}"`)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (input.entity_id) {
    query = query.eq("entity_id", input.entity_id);
  }

  const { data, error } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as KbFact[];
}

export type SearchKbContentInput = {
  q: string;
  city_id?: string | null;
  country_code?: string | null;
  entity_type?: KbEntity["entity_type"] | null;
  limit?: number;
};

export type SearchKbContentResult = {
  entities: KbEntity[];
  facts: KbFact[];
};

/**
 * GET /api/kb/search — keyword on entity name/description + approved fact body.
 * Parallel reads; ranking / card shaping stays in @pureluxe/kb.
 */
export async function searchKbContent(
  input: SearchKbContentInput,
): Promise<SearchKbContentResult> {
  const q = input.q.trim();
  if (!q) return { entities: [], facts: [] };

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);

  const [entities, facts] = await Promise.all([
    listActiveKbEntities({
      q,
      city_id: input.city_id,
      country_code: input.country_code,
      entity_type: input.entity_type,
      limit,
    }),
    searchApprovedKbFacts({ q, limit }),
  ]);

  return { entities, facts };
}
