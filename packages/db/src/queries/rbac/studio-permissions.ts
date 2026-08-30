import { getServiceClient } from "../../client";
import { dbQueryError } from "../../errors";

/** Active permission slugs granted to a role — used at login and session hydration. */
export async function listPermissionSlugsByRole(
  roleSlug: string,
): Promise<string[]> {
  const supabase = getServiceClient();
  const normalized = roleSlug.trim().toLowerCase();

  const { data: rolePermissions, error: roleError } = await supabase
    .from("studio_role_permissions")
    .select("permission_slug")
    .eq("role_slug", normalized);

  if (roleError) {
    throw dbQueryError(roleError);
  }

  const slugs = (rolePermissions ?? []).map((row) => row.permission_slug);
  if (slugs.length === 0) {
    return [];
  }

  const { data: permissions, error: permissionError } = await supabase
    .from("studio_permissions")
    .select("slug")
    .in("slug", slugs)
    .eq("active", true);

  if (permissionError) {
    throw dbQueryError(permissionError);
  }

  return (permissions ?? []).map((row) => row.slug);
}
