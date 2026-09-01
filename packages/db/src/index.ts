export { createServiceClient, getServiceClient } from "./client";
export { dbConfigError, dbQueryError } from "./errors";
export {
  acceptInviteAndCreateMember,
  createStudioInvite,
  findActiveStudioRoleBySlug,
  findPendingInviteByEmail,
  findTeamMemberByEmail,
  findTeamMemberById,
  listActiveStudioPermissions,
  listActiveStudioRoles,
  listPendingInvites,
  listPermissionSlugsByRole,
  listStudioRolePermissionGrants,
  listTeamMembers,
  replaceRolePermissions,
  revokeStudioInvite,
  touchStudioInvite,
  touchTeamMemberLastLogin,
  updateTeamMember,
} from "./queries";
export {
  DEFAULT_STUDIO_ROLE_SLUGS,
  type DefaultStudioRoleSlug,
  type InviteStatus,
  type StudioInvite,
  type StudioPermissionRecord,
  type StudioRole,
  type StudioRolePermissionRecord,
  type StudioRoleRecord,
  type TeamMember,
} from "./schema";
export {
  getSupabaseEnv,
  supabaseEnvSchema,
  type SupabaseEnv,
} from "./validation";
