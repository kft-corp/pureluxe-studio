import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TripLeg } from "../../schema";

export type UpsertFirstTripLegInput = {
  trip_id: string;
  destination: string;
  check_in: string;
  check_out: string;
  destination_profile_id?: string | null;
};

/** First leg on a trip (Phase 1 fixed stay), or null. */
export async function findFirstTripLeg(
  tripId: string,
): Promise<TripLeg | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .select("*")
      .eq("trip_id", tripId)
      .eq("sequence_order", 1)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLeg | null;
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

/**
 * Upsert sequence_order=1 leg — Phase 1 one-hotel stay shell.
 * Creates the first leg when missing; otherwise updates city/dates.
 */
export async function upsertFirstTripLeg(
  input: UpsertFirstTripLegInput,
): Promise<TripLeg> {
  const existing = await findFirstTripLeg(input.trip_id);
  const supabase = getServiceClient();

  if (existing) {
    const { data, error } = await runSupabaseQuery(() =>
      supabase
        .from("trip_legs")
        .update({
          destination: input.destination,
          check_in: input.check_in,
          check_out: input.check_out,
          destination_profile_id: input.destination_profile_id ?? null,
        })
        .eq("id", existing.id)
        .select("*")
        .single(),
    );

    if (error) {
      throw dbQueryError(error);
    }

    return data as TripLeg;
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .insert({
        trip_id: input.trip_id,
        sequence_order: 1,
        destination: input.destination,
        check_in: input.check_in,
        check_out: input.check_out,
        destination_profile_id: input.destination_profile_id ?? null,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLeg;
}

/** Every stay on a trip, earliest first. */
export async function listTripLegs(tripId: string): Promise<TripLeg[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .select("*")
      .eq("trip_id", tripId)
      .order("sequence_order", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as TripLeg[];
}

export type InsertTripLegInput = {
  trip_id: string;
  destination: string;
  check_in: string;
  check_out: string;
  destination_profile_id?: string | null;
};

/** Append a stay. Sequence is one past the last leg. */
export async function insertTripLeg(input: InsertTripLegInput): Promise<TripLeg> {
  const existing = await listTripLegs(input.trip_id);
  const sequence =
    existing.reduce((max, leg) => Math.max(max, leg.sequence_order), 0) + 1;
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .insert({
        trip_id: input.trip_id,
        sequence_order: sequence,
        destination: input.destination,
        check_in: input.check_in,
        check_out: input.check_out,
        destination_profile_id: input.destination_profile_id ?? null,
      })
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLeg;
}

/** Update city and dates on one stay. */
export async function updateTripLeg(
  legId: string,
  input: {
    destination: string;
    check_in: string;
    check_out: string;
    destination_profile_id?: string | null;
  },
): Promise<TripLeg> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_legs")
      .update({
        destination: input.destination,
        check_in: input.check_in,
        check_out: input.check_out,
        destination_profile_id: input.destination_profile_id ?? null,
      })
      .eq("id", legId)
      .select("*")
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripLeg;
}

/** Remove one stay. Line items and bookings are cleared by the caller first. */
export async function deleteTripLeg(tripId: string, legId: string): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("trip_legs").delete().eq("trip_id", tripId).eq("id", legId),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
