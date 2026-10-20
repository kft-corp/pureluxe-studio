import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { Trip, TripAssumptions, TripStatus } from "../../schema";
import { escapeIlike } from "../../utils/ilike";

const TRIP_COLUMNS = [
  "id",
  "primary_client_id",
  "relationship_owner_id",
  "title",
  "starts_on",
  "ends_on",
  "legs_confirmed_at",
  "travellers_confirmed_at",
  "status",
  "client_visibility",
  "published_at",
  "published_by_id",
  "sell_total",
  "sell_currency",
  "cost_total_internal",
  "margin_internal",
  "payment_plan",
  "pricing_locked_at",
  "pricing_locked_by_id",
  "source",
  "created_by_id",
  "is_demo",
  "archived_at",
  "archived_by_id",
  "last_studio_message_at",
  "last_studio_message_preview",
  "version",
  "assumptions",
  "created_at",
  "updated_at",
].join(", ");

/** Slim columns for Trip Builder home / switcher. */
const DIRECTORY_COLUMNS = [
  "id",
  "primary_client_id",
  "relationship_owner_id",
  "title",
  "status",
  "pricing_locked_at",
  "last_studio_message_at",
  "last_studio_message_preview",
  "created_at",
  "updated_at",
].join(", ");

export type TripDirectoryRow = Pick<
  Trip,
  | "id"
  | "primary_client_id"
  | "relationship_owner_id"
  | "title"
  | "status"
  | "pricing_locked_at"
  | "last_studio_message_at"
  | "last_studio_message_preview"
  | "created_at"
  | "updated_at"
>;

export type ListAssignedTripsInput = {
  ownerMemberId: string;
  q?: string;
  status?: TripStatus | "any";
  limit?: number;
  offset?: number;
};

export type ListAssignedTripsResult = {
  trips: TripDirectoryRow[];
  total: number;
  limit: number;
  offset: number;
};

export type InsertTripInput = {
  primary_client_id?: string | null;
  relationship_owner_id: string;
  title?: string | null;
  status?: TripStatus;
  created_by_id: string;
  is_demo?: boolean;
  source?: Trip["source"];
};

export type UpdateTripRecord = {
  primary_client_id?: string | null;
  title?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  legs_confirmed_at?: string | null;
  travellers_confirmed_at?: string | null;
  status?: TripStatus;
  relationship_owner_id?: string | null;
  sell_total?: number | null;
  sell_currency?: string | null;
  payment_plan?: Record<string, unknown> | null;
  cost_total_internal?: number | null;
  margin_internal?: number | null;
  pricing_locked_at?: string | null;
  pricing_locked_by_id?: string | null;
  assumptions?: TripAssumptions;
};

/** Look up a trip by id (null if missing). */
export async function findTripById(tripId: string): Promise<Trip | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trips")
      .select(TRIP_COLUMNS)
      .eq("id", tripId)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as Trip | null;
}

/** Assigned, non-archived, non-demo trips for Trip Builder home / switcher. */
export async function listAssignedTrips(
  input: ListAssignedTripsInput,
): Promise<ListAssignedTripsResult> {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const supabase = getServiceClient();

  let query = supabase
    .from("trips")
    .select(DIRECTORY_COLUMNS, { count: "exact" })
    .eq("relationship_owner_id", input.ownerMemberId)
    .eq("is_demo", false)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (input.status && input.status !== "any") {
    query = query.eq("status", input.status);
  }

  const q = input.q?.trim();
  if (q) {
    query = query.ilike("title", `%${escapeIlike(q)}%`);
  }

  const { data, error, count } = await runSupabaseQuery(() => query);

  if (error) {
    throw dbQueryError(error);
  }

  return {
    trips: (data as unknown as TripDirectoryRow[] | null) ?? [],
    total: count ?? 0,
    limit,
    offset,
  };
}

/** Insert a Studio trip row. */
export async function insertTrip(input: InsertTripInput): Promise<Trip> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trips")
      .insert({
        primary_client_id: input.primary_client_id ?? null,
        relationship_owner_id: input.relationship_owner_id,
        title: input.title ?? null,
        status: input.status ?? "building",
        created_by_id: input.created_by_id,
        is_demo: input.is_demo ?? false,
        source: input.source ?? "studio",
      })
      .select(TRIP_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as Trip;
}

/** Patch whitelisted trip columns; returns the updated row. */
export async function updateTrip(
  tripId: string,
  patch: UpdateTripRecord,
): Promise<Trip | null> {
  if (Object.keys(patch).length === 0) {
    return findTripById(tripId);
  }

  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trips")
      .update(patch)
      .eq("id", tripId)
      .select(TRIP_COLUMNS)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as Trip | null;
}
