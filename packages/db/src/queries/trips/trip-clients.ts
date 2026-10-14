import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TripClient, TripPartyRole } from "../../schema";

/** The traveller still linked as primary, even if the trip row lost that id. */
export async function findPrimaryTripClient(
  tripId: string,
): Promise<TripClient | null> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .select("*")
      .eq("trip_id", tripId)
      .eq("role", "primary")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data as TripClient | null) ?? null;
}

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
          party_role: "adult",
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

export type TripTravellerRow = {
  id: string;
  trip_id: string;
  client_id: string;
  role: TripClient["role"];
  party_role: TripPartyRole;
  display_name: string;
};

/** Every named person on the trip. The lead is first. */
export async function listTripTravellers(tripId: string): Promise<TripTravellerRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .select("id, trip_id, client_id, role, party_role, clients(display_name)")
      .eq("trip_id", tripId),
  );

  if (error) throw dbQueryError(error);

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const client = row.clients as
      | { display_name: string }
      | { display_name: string }[]
      | null;
    const displayName = Array.isArray(client)
      ? (client[0]?.display_name ?? "")
      : (client?.display_name ?? "");
    const party = row.party_role === "child" ? "child" : "adult";
    return {
      id: String(row.id),
      trip_id: String(row.trip_id),
      client_id: String(row.client_id),
      role: row.role === "primary" ? "primary" : "companion",
      party_role: party,
      display_name: displayName,
    } satisfies TripTravellerRow;
  });

  return rows.sort((a, b) => {
    if (a.role === b.role) return a.display_name.localeCompare(b.display_name);
    return a.role === "primary" ? -1 : 1;
  });
}

/** Add or update a companion. Does not change the lead. */
export async function upsertTripCompanion(
  tripId: string,
  clientId: string,
  partyRole: TripPartyRole,
): Promise<TripClient> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .upsert(
        {
          trip_id: tripId,
          client_id: clientId,
          role: "companion",
          party_role: partyRole,
        },
        { onConflict: "trip_id,client_id" },
      )
      .select("*")
      .single(),
  );

  if (error) throw dbQueryError(error);
  return data as TripClient;
}

/** Remove a companion. The lead row is left in place. */
export async function deleteTripCompanion(tripId: string, clientId: string): Promise<void> {
  const supabase = getServiceClient();
  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .delete()
      .eq("trip_id", tripId)
      .eq("client_id", clientId)
      .eq("role", "companion"),
  );

  if (error) throw dbQueryError(error);
}
