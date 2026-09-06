import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { ClientTier } from "../../schema";

const TIER_COLUMNS =
  "id, slug, label, rank, description, is_default, active, config, created_at, updated_at";

/** Default tier for new clients (is_default = true). */
export async function findDefaultClientTier(): Promise<ClientTier | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_tiers")
      .select(TIER_COLUMNS)
      .eq("is_default", true)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientTier | null) ?? null;
}

/** Find tier by primary key. */
export async function findClientTierById(
  tierId: string,
): Promise<ClientTier | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_tiers")
      .select(TIER_COLUMNS)
      .eq("id", tierId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientTier | null) ?? null;
}

/** Find tier by stable slug (standard | vip | vvip | …). */
export async function findClientTierBySlug(
  slug: string,
): Promise<ClientTier | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_tiers")
      .select(TIER_COLUMNS)
      .eq("slug", slug)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as ClientTier | null) ?? null;
}

/** Active tiers for filters / pickers, ordered by rank. */
export async function listActiveClientTiers(): Promise<ClientTier[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("client_tiers")
      .select(TIER_COLUMNS)
      .eq("active", true)
      .order("rank", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as ClientTier[];
}
