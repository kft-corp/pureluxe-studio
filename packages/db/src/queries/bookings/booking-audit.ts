import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { BookingAuditPerformedBy } from "../../schema";

/** Append booking audit rows (status / money / ref / field changes). */
export async function insertBookingAuditLogs(
  entries: Array<{
    booking_id: string;
    action: string;
    field_name?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    performed_by?: BookingAuditPerformedBy;
    team_member_id: string | null;
    metadata?: Record<string, unknown>;
  }>,
): Promise<void> {
  if (entries.length === 0) return;

  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("booking_audit_log").insert(
      entries.map((entry) => ({
        booking_id: entry.booking_id,
        action: entry.action,
        field_name: entry.field_name ?? null,
        old_value: entry.old_value ?? null,
        new_value: entry.new_value ?? null,
        performed_by: entry.performed_by ?? "team",
        team_member_id: entry.team_member_id,
        metadata: entry.metadata ?? {},
      })),
    ),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
