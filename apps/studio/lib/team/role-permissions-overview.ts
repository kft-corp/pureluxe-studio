import {
  listActiveStudioPermissions,
  listActiveStudioRoles,
  listStudioRolePermissionGrants,
} from "@pureluxe/db";
import type { StudioPermissionRecord, StudioRoleRecord } from "@pureluxe/db";

export type PermissionCatalogItem = Pick<
  StudioPermissionRecord,
  "slug" | "module" | "action" | "label" | "description" | "sort_order"
>;

export type RolePermissionsOverviewData = {
  roles: StudioRoleRecord[];
  permissions: PermissionCatalogItem[];
  grantsByRole: Record<string, string[]>;
  canManage: boolean;
};

function toPermissionCatalogItem(
  permission: StudioPermissionRecord,
): PermissionCatalogItem {
  return {
    slug: permission.slug,
    module: permission.module,
    action: permission.action,
    label: permission.label,
    description: permission.description,
    sort_order: permission.sort_order,
  };
}

function buildGrantsByRole(
  roles: StudioRoleRecord[],
  grants: Array<{ role_slug: string; permission_slug: string }>,
): Record<string, string[]> {
  const grantsByRole = Object.fromEntries(
    roles.map((role) => [role.slug, [] as string[]]),
  );

  for (const grant of grants) {
    if (!grantsByRole[grant.role_slug]) {
      grantsByRole[grant.role_slug] = [];
    }
    grantsByRole[grant.role_slug].push(grant.permission_slug);
  }

  for (const roleSlug of Object.keys(grantsByRole)) {
    grantsByRole[roleSlug].sort();
  }

  return grantsByRole;
}

/** Load roles, permission catalog, and grants for the role permissions tab. */
export async function getRolePermissionsOverview(
  canManage: boolean,
): Promise<RolePermissionsOverviewData> {
  const [roles, permissions, grants] = await Promise.all([
    listActiveStudioRoles(),
    listActiveStudioPermissions(),
    listStudioRolePermissionGrants(),
  ]);

  return {
    roles,
    permissions: permissions.map(toPermissionCatalogItem),
    grantsByRole: buildGrantsByRole(roles, grants),
    canManage,
  };
}
