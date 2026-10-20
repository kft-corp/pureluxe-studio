import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { TripPendingConfirm, TripUndoAction } from "../../schema";

const UNDO_COLUMNS = [
  "id",
  "trip_id",
  "member_id",
  "action",
  "tool",
  "args",
  "summary",
  "before_payload",
  "after_payload",
  "idempotency_key",
  "created_at",
  "expires_at",
  "consumed_at",
].join(", ");

const CONFIRM_COLUMNS = [
  "id",
  "trip_id",
  "member_id",
  "tool",
  "args",
  "status",
  "thread_id",
  "trip_version",
  "summary",
  "created_at",
  "expires_at",
  "consumed_at",
  "consumed_by_id",
].join(", ");

/** Approval cards expire after 15 minutes. */
const CONFIRM_TTL_MS = 15 * 60 * 1000;

/** The stored result for a change already made with this key. Null when it is new. */
export async function findTripChangeResult(input: {
  tripId: string;
  memberId: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown> | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_idempotency_keys")
      .select("result")
      .eq("trip_id", input.tripId)
      .eq("member_id", input.memberId)
      .eq("idempotency_key", input.idempotencyKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data?.result as Record<string, unknown> | null | undefined) ?? null;
}

/**
 * Record one agent change: version + 1, Undo copy, duplicate record. Returns the new version.
 * `before: null` records a change that can't be undone.
 */
export async function recordTripChange(input: {
  tripId: string;
  memberId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  idempotencyKey: string;
}): Promise<number> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.rpc("agent_record_trip_change", {
      p_trip_id: input.tripId,
      p_member_id: input.memberId,
      p_tool: input.tool,
      p_args: input.args,
      p_summary: input.summary,
      p_before: input.before,
      p_after: input.after,
      p_idempotency_key: input.idempotencyKey,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as number;
}

/** The newest change on a trip that can still be undone. */
export async function findLatestTripUndo(tripId: string): Promise<TripUndoAction | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_undo_actions")
      .select(UNDO_COLUMNS)
      .eq("trip_id", tripId)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripUndoAction | null;
}

/** Mark an Undo used (once) and bump the trip version. Returns the new version. */
export async function recordTripUndo(input: {
  tripId: string;
  undoId: string;
  memberId: string;
  idempotencyKey: string;
}): Promise<number> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.rpc("agent_record_trip_undo", {
      p_trip_id: input.tripId,
      p_undo_id: input.undoId,
      p_member_id: input.memberId,
      p_idempotency_key: input.idempotencyKey,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as number;
}

/** Show an approval card. Any earlier open card for this advisor and trip is superseded. */
export async function insertTripApproval(input: {
  tripId: string;
  memberId: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  threadId: string;
  tripVersion: number | null;
}): Promise<TripPendingConfirm> {
  const supabase = getServiceClient();

  const { error: supersedeError } = await runSupabaseQuery(() =>
    supabase
      .from("trip_pending_confirms")
      .update({ status: "superseded" })
      .eq("trip_id", input.tripId)
      .eq("member_id", input.memberId)
      .eq("status", "pending"),
  );

  if (supersedeError) {
    throw dbQueryError(supersedeError);
  }

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_pending_confirms")
      .insert({
        trip_id: input.tripId,
        member_id: input.memberId,
        tool: input.tool,
        args: input.args,
        summary: input.summary,
        thread_id: input.threadId,
        trip_version: input.tripVersion,
        expires_at: new Date(Date.now() + CONFIRM_TTL_MS).toISOString(),
      })
      .select(CONFIRM_COLUMNS)
      .single(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as unknown as TripPendingConfirm;
}

/** The advisor's open approval card on this trip. Null when none. */
export async function findOpenTripApproval(
  tripId: string,
  memberId: string,
): Promise<TripPendingConfirm | null> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_pending_confirms")
      .select(CONFIRM_COLUMNS)
      .eq("trip_id", tripId)
      .eq("member_id", memberId)
      .eq("status", "pending")
      .maybeSingle(),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data as TripPendingConfirm | null;
}

/** Close an approval card: used (Confirm or Cancel), or expired. */
export async function closeTripApproval(input: {
  id: string;
  status: "consumed" | "expired";
  memberId: string;
}): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase
      .from("trip_pending_confirms")
      .update({
        status: input.status,
        consumed_at: new Date().toISOString(),
        consumed_by_id: input.memberId,
      })
      .eq("id", input.id)
      .eq("status", "pending"),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
