import type { PermissionCatalogItem } from "@/lib/api/team";
import { formatModuleLabel } from "@/lib/rbac/format-module-label";

export type PermissionModuleGroup = {
  module: string;
  label: string;
  permissions: PermissionCatalogItem[];
};

/** Permissions that are typically restricted to admin roles. */
export const ADMIN_ONLY_PERMISSION_SLUGS = new Set([
  "team.manage",
  "settings.manage",
]);

export function groupPermissionsByModule(
  permissions: PermissionCatalogItem[],
): PermissionModuleGroup[] {
  const groups = new Map<string, PermissionCatalogItem[]>();

  for (const permission of permissions) {
    const current = groups.get(permission.module) ?? [];
    current.push(permission);
    groups.set(permission.module, current);
  }

  return [...groups.entries()]
    .map(([module, modulePermissions]) => ({
      module,
      label: formatModuleLabel(module),
      permissions: [...modulePermissions].sort((left, right) => {
        if (left.sort_order !== right.sort_order) {
          return left.sort_order - right.sort_order;
        }
        return left.action.localeCompare(right.action);
      }),
    }))
    .sort((left, right) => {
      const leftOrder = left.permissions[0]?.sort_order ?? 0;
      const rightOrder = right.permissions[0]?.sort_order ?? 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return left.label.localeCompare(right.label);
    });
}

export function listModuleKeys(permissions: readonly PermissionCatalogItem[]): string[] {
  return [...new Set(permissions.map((permission) => permission.module))].sort();
}

export function defaultExpandedModules(modules: readonly string[]): Set<string> {
  const first = modules[0];
  return first ? new Set([first]) : new Set();
}

export function filterModuleGroups(
  groups: PermissionModuleGroup[],
  query: string,
): PermissionModuleGroup[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return groups;
  }

  return groups
    .map((group) => {
      const moduleMatches =
        group.module.includes(normalized) ||
        group.label.toLowerCase().includes(normalized);

      const permissions = group.permissions.filter((permission) => {
        if (moduleMatches) {
          return true;
        }

        return (
          permission.label.toLowerCase().includes(normalized) ||
          permission.action.toLowerCase().includes(normalized) ||
          permission.slug.toLowerCase().includes(normalized)
        );
      });

      return { ...group, permissions };
    })
    .filter((group) => group.permissions.length > 0);
}

export function countEnabledInModule(
  permissions: readonly PermissionCatalogItem[],
  draftGrants: ReadonlySet<string>,
): { enabled: number; total: number } {
  const total = permissions.length;
  const enabled = permissions.reduce(
    (count, permission) => count + (draftGrants.has(permission.slug) ? 1 : 0),
    0,
  );

  return { enabled, total };
}

export function moduleGrantStatusClass(enabled: number, total: number): string {
  if (enabled === total) {
    return "bg-emerald-50 text-emerald-800";
  }
  if (enabled > 0) {
    return "bg-amber-50 text-amber-800";
  }
  return "bg-stone-100 text-stone-600";
}

export function setsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }

  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }

  return true;
}

export function permissionHint(
  permission: PermissionCatalogItem,
  checked: boolean,
): string | null {
  if (ADMIN_ONLY_PERMISSION_SLUGS.has(permission.slug) && !checked) {
    return "Admin only";
  }

  return permission.description;
}
