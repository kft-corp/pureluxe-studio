import {
  findDestinationProfileByText,
  type DestinationProfile,
  type DestinationType,
} from "@pureluxe/db";

/** Free-text destination after alias / canonical match. */
export type ResolvedDestination = {
  profile: DestinationProfile | null;
  destination_type: DestinationType | null;
};

/**
 * Map leg destination text → active profile + type.
 * No match → both null (Layer 4 company default).
 */
export async function resolveDestinationProfile(
  destinationText?: string | null,
): Promise<ResolvedDestination> {
  const text = destinationText?.trim() ?? "";
  if (!text) {
    return { profile: null, destination_type: null };
  }

  const profile = await findDestinationProfileByText(text);
  return {
    profile,
    destination_type: profile?.destination_type ?? null,
  };
}
