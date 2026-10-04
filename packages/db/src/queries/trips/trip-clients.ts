import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TripClient } from "../../schema";

/**
 * Keep trips.primary_client_id in sync with trip_clients (one primary).
 * Demotes any prior primary, then upserts this client as primary.
 */
export async function setTripPrimaryClient(
  tripId: string,
  clientId: string,
): Promise<TripClient> {
  const supabase = getServiceClient();

  const { error: demoteError } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .update({ role: "companion" })
      .eq("trip_id", tripId)
      .eq("role", "primary")
      .neq("client_id", clientId),
  );

  if (demoteError) {
    throw dbQueryError(demoteError);
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .upsert(
        {
          trip_id: tripId,
          client_id: clientId,
          role: "primary",
        },
        { onConflict: "trip_id,client_id" },
      )
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripClient;
}
