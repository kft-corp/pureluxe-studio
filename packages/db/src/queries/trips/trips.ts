import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { Trip, TripLeg } from "../../schema";

/** Look up a trip by id (null if missing). */
export async function findTripById(tripId: string): Promise<Trip | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("trips").select("*").eq("id", tripId).maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as Trip | null;
}

/** Look up a trip leg by id (null if missing). */
export async function findTripLegById(legId: string): Promise<TripLeg | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("trip_legs").select("*").eq("id", legId).maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLeg | null;
}
