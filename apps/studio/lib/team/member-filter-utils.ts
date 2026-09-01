import type { PendingInviteListItem, TeamMemberListItem } from "@/lib/api/team";

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
  return filter === "inactive" ? "Inactive members" : "Active members";
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
