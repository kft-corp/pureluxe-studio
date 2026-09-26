import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { DestinationType, RatePeakWindow } from "../../schema";

export type ListPeakWindowsInput = {
  /** Stay start (YYYY-MM-DD). */
  check_in: string;
  /** Stay end (YYYY-MM-DD). */
  check_out: string;
  destination_profile_id?: string | null;
  destination_type?: DestinationType | null;
};

function datesOverlapStayNights(
  windowStart: string,
  windowEnd: string,
  checkIn: string,
  checkOut: string,
): boolean {
  // Stay nights are [check_in, check_out) — checkout day is not a night.
  return windowStart < checkOut && windowEnd >= checkIn;
}

/**
 * Active peak windows that overlap the stay.
 * Includes type-wide windows and optional profile-specific ones.
 */
export async function listActivePeakWindowsForStay(
  input: ListPeakWindowsInput,
): Promise<RatePeakWindow[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase.from("rate_peak_windows").select("*").eq("active", true),
  );

  if (error) {
    throw dbQueryError(error);
  }

  const rows = (data ?? []) as RatePeakWindow[];

  return rows.filter((row) => {
    if (!datesOverlapStayNights(row.start_date, row.end_date, input.check_in, input.check_out)) {
      return false;
    }

    const matchesProfile =
      input.destination_profile_id != null &&
      row.destination_profile_id === input.destination_profile_id;

    const matchesType =
      input.destination_type != null &&
      row.destination_type === input.destination_type &&
      row.destination_profile_id == null;

    // Profile-specific windows always apply when ids match.
    if (matchesProfile) return true;

    // Type-wide windows (no profile) when type matches.
    if (matchesType) return true;

    // If caller passed neither scope, return any overlapping active window.
    if (
      input.destination_profile_id == null &&
      input.destination_type == null
    ) {
      return true;
    }

    return false;
  });
}
