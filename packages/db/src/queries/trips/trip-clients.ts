import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TripClient, TripPartyRole } from "../../schema";

function asPartyRole(value: unknown): TripPartyRole {
  if (value === "child" || value === "infant") return value;
  return "adult";
}

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
  stated_age: number | null;
  date_of_birth: string | null;
  gender: string | null;
  display_name: string;
};

/** Every named person on the trip. The lead is first. */
export async function listTripTravellers(tripId: string): Promise<TripTravellerRow[]> {
  const supabase = getServiceClient();
  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_clients")
      .select(
        "id, trip_id, client_id, role, party_role, stated_age, clients(display_name, date_of_birth, gender)",
      )
      .eq("trip_id", tripId),
  );

  if (error) throw dbQueryError(error);

  const rows = ((data as Record<string, unknown>[] | null) ?? []).map((row) => {
    const client = row.clients as
      | {
          display_name: string;
          date_of_birth: string | null;
          gender: string | null;
        }
      | {
          display_name: string;
          date_of_birth: string | null;
          gender: string | null;
        }[]
      | null;
    const linked = Array.isArray(client) ? client[0] : client;
    const stated =
      typeof row.stated_age === "number" && Number.isFinite(row.stated_age)
        ? row.stated_age
        : null;
    return {
      id: String(row.id),
      trip_id: String(row.trip_id),
      client_id: String(row.client_id),
      role: row.role === "primary" ? "primary" : "companion",
      party_role: asPartyRole(row.party_role),
      stated_age: stated,
      date_of_birth: linked?.date_of_birth ?? null,
      gender: linked?.gender ?? null,
      display_name: linked?.display_name ?? "",
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
  statedAge?: number | null,
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
          ...(statedAge !== undefined ? { stated_age: statedAge } : {}),
        },
        { onConflict: "trip_id,client_id" },
      )
      .select("*")
      .single(),
  );

  if (error) throw dbQueryError(error);
  return data as TripClient;
}

/** Persist advisor-stated ages on trip_clients for this trip. */
export async function updateTripClientStatedAges(
  tripId: string,
  ages: Array<{ clientId: string; statedAge: number }>,
): Promise<void> {
  if (ages.length === 0) return;
  const supabase = getServiceClient();
  await Promise.all(
    ages.map(async ({ clientId, statedAge }) => {
      const { error } = await runSupabaseQuery(() =>
        supabase
          .from("trip_clients")
          .update({ stated_age: statedAge })
          .eq("trip_id", tripId)
          .eq("client_id", clientId),
      );
      if (error) throw dbQueryError(error);
    }),
  );
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
