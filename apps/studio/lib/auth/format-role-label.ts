/** Human-readable label from a studio role slug. */
export function formatRoleLabel(role: string): string {
  return role
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
