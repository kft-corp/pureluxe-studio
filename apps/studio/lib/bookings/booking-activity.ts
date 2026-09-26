import {
  findTeamMemberNamesByIds,
  listBookingAuditLogs,
  type BookingAuditLog,
} from "@pureluxe/db";

import { BOOKING_DETAIL_LIST_LIMITS } from "./booking-limits";

export type BookingAuditEntry = BookingAuditLog & {
  team_member: { id: string; name: string } | null;
};

async function withTeamMemberNames(
  logs: BookingAuditLog[],
): Promise<BookingAuditEntry[]> {
  const names = await findTeamMemberNamesByIds(
    logs
      .map((log) => log.team_member_id)
      .filter((id): id is string => Boolean(id)),
  );

  return logs.map((log) => ({
    ...log,
    team_member:
      log.team_member_id != null
        ? {
            id: log.team_member_id,
            name: names.get(log.team_member_id) ?? "Team member",
          }
        : null,
  }));
}

/** Recent activity for booking detail Activity tab. */
export async function listRecentBookingActivity(
  bookingId: string,
): Promise<{ activity: BookingAuditEntry[]; total: number }> {
  const { logs, total } = await listBookingAuditLogs(bookingId, {
    limit: BOOKING_DETAIL_LIST_LIMITS.audit,
    offset: 0,
  });
  return {
    activity: await withTeamMemberNames(logs),
    total,
  };
}
