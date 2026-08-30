import { getServiceClient } from "../../client";
import { dbQueryError } from "../../errors";
import type { StudioRoleRecord } from "../../schema/studio-roles";

/** Active roles for invite UI and RBAC — ordered by sort_order. */
export async function listActiveStudioRoles(): Promise<StudioRoleRecord[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("studio_roles")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw dbQueryError(error);
  }

  return (data ?? []) as StudioRoleRecord[];
}

/** Look up a role slug — returns null if missing or inactive. */
export async function findActiveStudioRoleBySlug(
  slug: string,
): Promise<StudioRoleRecord | null> {
  const supabase = getServiceClient();
  const normalized = slug.trim().toLowerCase();

  const { data, error } = await supabase
    .from("studio_roles")
    .select("*")
    .eq("slug", normalized)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw dbQueryError(error);
  }

  return data as StudioRoleRecord | null;
}
