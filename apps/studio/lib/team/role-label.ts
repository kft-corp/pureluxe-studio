import { formatRoleLabel } from "@/lib/auth/format-role-label";
import type { TeamOverviewData } from "@/lib/api/team";

/** Human-readable role label from the roles catalog, with slug fallback. */
export function getRoleLabel(
  roles: TeamOverviewData["roles"],
  slug: string,
): string {
  return roles.find((role) => role.slug === slug)?.label ?? formatRoleLabel(slug);
}
