import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";

/**
 * Take the one-run-per-trip lock, or renew it for the same run.
 * False while another live run holds the trip.
 */
export async function beginAgentRun(input: {
  tripId: string;
  runId: string;
  ttlSeconds: number;
}): Promise<boolean> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.rpc("agent_begin_run", {
      p_trip_id: input.tripId,
      p_run_id: input.runId,
      p_ttl_seconds: input.ttlSeconds,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data === true;
}

/** Release the lock held by this run. No-op when another run holds it. */
export async function endAgentRun(input: { tripId: string; runId: string }): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.rpc("agent_end_run", {
      p_trip_id: input.tripId,
      p_run_id: input.runId,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
