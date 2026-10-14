import { z } from "zod";

/** Permission slug format — module.action. */
export const permissionSlugSchema = z
  .string()
  .trim()
  .min(3, { message: "Permission slug is required" })
  .max(129, { message: "Permission slug is too long" })
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, {
    message: "Permission slug must use module.action format",
  });

/** Role slug format — must match DB CHECK on studio_roles.slug. */
export const studioRoleSlugSchema = z
  .string()
  .trim()
  .min(1, { message: "Role is required" })
  .max(64, { message: "Role slug is too long" })
  .regex(/^[a-z][a-z0-9_]*$/, {
    message: "Role slug must use lowercase letters, numbers, and underscores",
  });

/** @deprecated Use studioRoleSlugSchema — kept for existing imports. */
export const studioRoleSchema = studioRoleSlugSchema;

export type StudioRoleInput = z.infer<typeof studioRoleSlugSchema>;

/** Admin invite form / API body. */
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Enter a valid email address" })
    .transform((value) => value.toLowerCase()),
  role: studioRoleSlugSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/** Update an existing member role. */
export const updateMemberRoleSchema = z.object({
  role: studioRoleSlugSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

/** Deactivate or reactivate a member. */
export const updateMemberStatusSchema = z.object({
  active: z.boolean(),
});

export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;

/** Replace all grants for one role. */
export const updateRolePermissionsSchema = z.object({
  permissionSlugs: z.array(permissionSlugSchema),
});

export type UpdateRolePermissionsInput = z.infer<typeof updateRolePermissionsSchema>;
