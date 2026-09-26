"use client";

import type { StudioRoleRecord } from "@pureluxe/db";

import { PillTabs } from "@/components/ui/pill-tabs";

type RolePermissionsRolePickerProps = {
  roles: StudioRoleRecord[];
  selectedRoleSlug: string;
  onSelectRole: (roleSlug: string) => void;
};

export function RolePermissionsRolePicker({
  roles,
  selectedRoleSlug,
  onSelectRole,
}: RolePermissionsRolePickerProps) {
  return (
    <PillTabs
      items={roles.map((role) => ({ id: role.slug, label: role.label }))}
      value={selectedRoleSlug}
      onChange={onSelectRole}
      ariaLabel="Roles"
    />
  );
}
