import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  DestinationRoutingOverride,
  DestinationTypeDefault,
  DestinationWholesaler,
} from "../../schema";

/** Layer 3 type → pattern defaults (active only). */
export async function listActiveDestinationTypeDefaults(): Promise<
  DestinationTypeDefault[]
> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("destination_type_defaults")
      .select("*")
      .eq("active", true),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as DestinationTypeDefault[];
}

/** Active Layer 2 override for a destination profile, if any. */
export async function findActiveRoutingOverride(
  destinationProfileId: string,
): Promise<DestinationRoutingOverride | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("destination_routing_overrides")
      .select("*")
      .eq("destination_profile_id", destinationProfileId)
      .eq("active", true)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as DestinationRoutingOverride | null;
}

/** Active wholesaler bindings for a destination (priority ascending). */
export async function listActiveWholesalersForProfile(
  destinationProfileId: string,
): Promise<DestinationWholesaler[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("destination_wholesalers")
      .select("*")
      .eq("destination_profile_id", destinationProfileId)
      .eq("active", true)
      .order("priority", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as DestinationWholesaler[];
}
