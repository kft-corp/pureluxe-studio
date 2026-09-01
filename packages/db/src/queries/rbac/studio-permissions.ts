import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type { StudioPermissionRecord } from "../../schema/studio-permissions";

/** Active permission catalog — ordered by module then action. */
export async function listActiveStudioPermissions(): Promise<StudioPermissionRecord[]> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("studio_permissions")
      .select("*")
      .eq("active", true)
      .order("module", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("action", { ascending: true }),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as StudioPermissionRecord[];
}

/** All role → permission grants for the permissions matrix UI. */
export async function listStudioRolePermissionGrants(): Promise<
  Array<{ role_slug: string; permission_slug: string }>
> {
  const supabase = getServiceClient();

  const { data, error } = await runSupabaseQuery(() =>
    supabase
      .from("studio_role_permissions")
      .select("role_slug, permission_slug"),
  );

  if (error) {
    throw dbQueryError(error);
  }

  return data ?? [];
}

/** Active permission slugs granted to a role — used at login and session hydration. */
export async function listPermissionSlugsByRole(
  roleSlug: string,
): Promise<string[]> {
  const supabase = getServiceClient();
  const normalized = roleSlug.trim().toLowerCase();

  const { data: rolePermissions, error: roleError } = await runSupabaseQuery(
    () =>
      supabase
        .from("studio_role_permissions")
        .select("permission_slug")
        .eq("role_slug", normalized),
  );

  if (roleError) {
    throw dbQueryError(roleError);
  }

  const slugs = (rolePermissions ?? []).map((row) => row.permission_slug);
  if (slugs.length === 0) {
    return [];
  }

  const { data: permissions, error: permissionError } = await runSupabaseQuery(
    () =>
      supabase
        .from("studio_permissions")
        .select("slug")
        .in("slug", slugs)
        .eq("active", true),
  );

  if (permissionError) {
    throw dbQueryError(permissionError);
  }

  return (permissions ?? []).map((row) => row.slug);
}

/** Sync role grants to the provided active permission slugs. */
export async function replaceRolePermissions(
  roleSlug: string,
  permissionSlugs: readonly string[],
): Promise<string[]> {
  const supabase = getServiceClient();
  const normalizedRole = roleSlug.trim().toLowerCase();
  const desired = [...new Set(permissionSlugs.map((slug) => slug.trim().toLowerCase()))];

  const { data: activePermissions, error: catalogError } = await runSupabaseQuery(
    () =>
      supabase
        .from("studio_permissions")
        .select("slug")
        .eq("active", true),
  );

  if (catalogError) {
    throw dbQueryError(catalogError);
  }

  const activeSlugs = new Set((activePermissions ?? []).map((row) => row.slug));
  const validDesired = desired.filter((slug) => activeSlugs.has(slug));

  const { data: currentRows, error: currentError } = await runSupabaseQuery(() =>
    supabase
      .from("studio_role_permissions")
      .select("permission_slug")
      .eq("role_slug", normalizedRole),
  );

  if (currentError) {
    throw dbQueryError(currentError);
  }

  const current = new Set((currentRows ?? []).map((row) => row.permission_slug));
  const next = new Set(validDesired);
  const toRemove = [...current].filter((slug) => !next.has(slug));
  const toAdd = [...next].filter((slug) => !current.has(slug));

  if (toRemove.length > 0) {
    const { error: deleteError } = await runSupabaseQuery(() =>
      supabase
        .from("studio_role_permissions")
        .delete()
        .eq("role_slug", normalizedRole)
        .in("permission_slug", toRemove),
    );

    if (deleteError) {
      throw dbQueryError(deleteError);
    }
  }

  if (toAdd.length > 0) {
    const { error: insertError } = await runSupabaseQuery(() =>
      supabase.from("studio_role_permissions").insert(
        toAdd.map((permissionSlug) => ({
          role_slug: normalizedRole,
          permission_slug: permissionSlug,
        })),
      ),
    );

    if (insertError) {
      throw dbQueryError(insertError);
    }
  }

  return validDesired;
}
