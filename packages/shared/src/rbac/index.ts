/** Studio module keys — align with sidebar routes and permission.module. */
export const STUDIO_MODULES = [
  "home",
  "trip_builder",
  "bookings",
  "clients",
  "trips",
  "trainer",
  "tasks",
  "commissions",
  "payments",
  "team",
  "settings",
] as const;

export type StudioModule = (typeof STUDIO_MODULES)[number];

/** Standard permission actions. */
export const PERMISSION_ACTIONS = [
  "read",
  "write",
  "delete",
  "manage",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionSlug = `${StudioModule}.${PermissionAction}`;

export function buildPermissionSlug(
  module: StudioModule,
  action: PermissionAction,
): PermissionSlug {
  return `${module}.${action}`;
}

export function parsePermissionSlug(
  slug: string,
): { module: string; action: string } | null {
  const dotIndex = slug.indexOf(".");
  if (dotIndex <= 0 || dotIndex === slug.length - 1) {
    return null;
  }

  return {
    module: slug.slice(0, dotIndex),
    action: slug.slice(dotIndex + 1),
  };
}

export function hasPermission(
  permissions: readonly string[],
  slug: string,
): boolean {
  return permissions.includes(slug);
}

export function hasModulePermission(
  permissions: readonly string[],
  module: StudioModule,
  action: PermissionAction = "read",
): boolean {
  return hasPermission(permissions, buildPermissionSlug(module, action));
}

export function hasAnyPermission(
  permissions: readonly string[],
  slugs: readonly string[],
): boolean {
  return slugs.some((slug) => permissions.includes(slug));
}

/** Nav and routes typically require module read access. */
export function moduleReadPermission(module: StudioModule): PermissionSlug {
  return buildPermissionSlug(module, "read");
}
