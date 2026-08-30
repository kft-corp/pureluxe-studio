export type StudioPermissionRecord = {
  slug: string;
  module: string;
  action: string;
  label: string;
  description: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type StudioRolePermissionRecord = {
  role_slug: string;
  permission_slug: string;
  created_at: string;
};
