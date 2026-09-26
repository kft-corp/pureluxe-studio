import type { PendingInviteListItem, TeamMemberListItem } from "@/lib/api/team";

import { getMemberDisplayName } from "./member-display-name";

export type MemberFilter = "all" | "active" | "pending" | "inactive";

type MemberLists = {
  active: TeamMemberListItem[];
  inactive: TeamMemberListItem[];
  pendingInvites: PendingInviteListItem[];
};

export function partitionMembers(members: TeamMemberListItem[]) {
  const active: TeamMemberListItem[] = [];
  const inactive: TeamMemberListItem[] = [];

  for (const member of members) {
    if (member.active) {
      active.push(member);
    } else {
      inactive.push(member);
    }
  }

  return { active, inactive };
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function memberMatchesQuery(
  member: TeamMemberListItem,
  query: string,
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;

  const displayName = getMemberDisplayName(member.name, member.email).toLowerCase();
  const email = member.email.toLowerCase();
  return displayName.includes(q) || email.includes(q);
}

export function inviteMatchesQuery(
  invite: PendingInviteListItem,
  query: string,
): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  return invite.email.toLowerCase().includes(q);
}

export function filterMembersByQuery(
  members: TeamMemberListItem[],
  query: string,
): TeamMemberListItem[] {
  if (!normalizeQuery(query)) return members;
  return members.filter((member) => memberMatchesQuery(member, query));
}

export function filterInvitesByQuery(
  invites: PendingInviteListItem[],
  query: string,
): PendingInviteListItem[] {
  if (!normalizeQuery(query)) return invites;
  return invites.filter((invite) => inviteMatchesQuery(invite, query));
}

export function getFilterCounts({
  active,
  inactive,
  pendingInvites,
}: MemberLists): Record<MemberFilter, number> {
  return {
    all: active.length + inactive.length + pendingInvites.length,
    active: active.length,
    pending: pendingInvites.length,
    inactive: inactive.length,
  };
}

export function getMembersSectionTitle(filter: MemberFilter): string {
  if (filter === "inactive") return "Inactive members";
  if (filter === "active") return "Active members";
  return "Team members";
}

export function getMembersSectionDescription(
  filter: MemberFilter,
  hasSearch: boolean,
): string {
  if (hasSearch) {
    return "People who match your search.";
  }
  if (filter === "inactive") {
    return "Deactivated accounts — reactivate to restore access.";
  }
  if (filter === "active") {
    return "People with access to Studio right now.";
  }
  return "Active people on your Studio workspace.";
}

export function getMembersForPrimarySection(
  filter: MemberFilter,
  { active, inactive }: Pick<MemberLists, "active" | "inactive">,
): TeamMemberListItem[] {
  if (filter === "inactive") {
    return inactive;
  }
  if (filter === "active" || filter === "all") {
    return active;
  }
  return [];
}

export function shouldShowMembersSection(filter: MemberFilter): boolean {
  return filter === "all" || filter === "active" || filter === "inactive";
}

export function shouldShowPendingSection(filter: MemberFilter): boolean {
  return filter === "all" || filter === "pending";
}

export function shouldShowInactiveSection(
  filter: MemberFilter,
  inactiveCount: number,
): boolean {
  return filter === "all" && inactiveCount > 0;
}
