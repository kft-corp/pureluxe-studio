import { z } from "zod";

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
