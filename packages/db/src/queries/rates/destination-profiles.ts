import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { DestinationProfile } from "../../schema";

function normalizeDestinationText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function aliasesOf(profile: DestinationProfile): string[] {
  if (!Array.isArray(profile.aliases)) return [];
  return profile.aliases
    .filter((alias): alias is string => typeof alias === "string")
    .map((alias) => alias.trim())
    .filter(Boolean);
}

/** Labels used for matching (canonical + aliases). */
function labelsOf(profile: DestinationProfile): string[] {
  return [profile.canonical_name, ...aliasesOf(profile)].map(
    normalizeDestinationText,
  );
}

/**
 * Match score: exact (3) > label starts with / contains needle (2) >
 * needle contains label (1). Higher wins.
 */
function matchScore(needle: string, label: string): number {
  if (!label) return 0;
  if (label === needle) return 3;
  if (label.startsWith(needle) || label.includes(needle)) return 2;
  if (needle.includes(label) && label.length >= 3) return 1;
  return 0;
}

/** Active destination profiles for routing and Settings. */
export async function listActiveDestinationProfiles(): Promise<
  DestinationProfile[]
> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("destination_profiles")
      .select("*")
      .eq("active", true)
      .order("canonical_name", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as DestinationProfile[];
}

/** Look up one active profile by id. */
export async function findActiveDestinationProfileById(
  profileId: string,
): Promise<DestinationProfile | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("destination_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as DestinationProfile | null;
}

/**
 * Match free-text leg destination to an active profile.
 * Exact alias/canonical first, then fuzzy contains (e.g. "Maldives islands").
 */
export async function findDestinationProfileByText(
  destinationText: string,
): Promise<DestinationProfile | null> {
  const needle = normalizeDestinationText(destinationText);
  if (!needle) return null;

  const profiles = await listActiveDestinationProfiles();

  let best: DestinationProfile | null = null;
  let bestScore = 0;

  for (const profile of profiles) {
    for (const label of labelsOf(profile)) {
      const score = matchScore(needle, label);
      if (score > bestScore) {
        bestScore = score;
        best = profile;
      }
    }
  }

  return bestScore > 0 ? best : null;
}
