export { createServiceClient, getServiceClient } from "./client";
export { dbConfigError, dbQueryError } from "./errors";
export {
  acceptInviteAndCreateMember,
  findActiveStudioRoleBySlug,
  findPendingInviteByEmail,
  findTeamMemberByEmail,
  listActiveStudioRoles,
  listPermissionSlugsByRole,
  touchTeamMemberLastLogin,
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
