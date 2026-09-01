import type { TeamMemberListItem } from "@/lib/api/team";

export function isCurrentMember(
  member: TeamMemberListItem,
  currentMemberId: string,
  currentMemberEmail: string,
): boolean {
  return (
    member.id === currentMemberId ||
    member.email.toLowerCase() === currentMemberEmail.toLowerCase()
  );
}
