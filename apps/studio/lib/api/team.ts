import { apiRoutes } from "@/lib/routes";
import type { TeamOverviewData } from "@/lib/team/team-overview";

import { fetchApi } from "./client";

export type { TeamMemberListItem, PendingInviteListItem, TeamOverviewData } from "@/lib/team/team-overview";

/** Load team members, pending invites, and roles. */
export function getTeamOverview() {
  return fetchApi<TeamOverviewData>(apiRoutes.team.members, {
    cache: "no-store",
  });
}

/** Invite a new team member. */
export function inviteTeamMember(input: { email: string; role: string }) {
  return fetchApi<{ id: string }>(apiRoutes.team.invites, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

/** Change a member's role. */
export function updateTeamMemberRole(memberId: string, role: string) {
  return fetchApi<{ id: string; role: string }>(apiRoutes.team.member(memberId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

/** Activate or deactivate a member. */
export function updateTeamMemberStatus(memberId: string, active: boolean) {
  return fetchApi<{ id: string; active: boolean }>(apiRoutes.team.member(memberId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ active }),
  });
}

/** Revoke a pending invite. */
export function revokeTeamInvite(inviteId: string) {
  return fetchApi<{ id: string }>(apiRoutes.team.invite(inviteId), {
    method: "DELETE",
  });
}

/** Refresh a pending invite timestamp. */
export function resendTeamInvite(inviteId: string) {
  return fetchApi<{ id: string }>(apiRoutes.team.inviteResend(inviteId), {
    method: "POST",
  });
}
