import { z } from "zod";

/** Studio role — must match DB CHECK on team_members.role. */
export const studioRoleSchema = z.enum([
  "advisor",
  "ops",
  "finance",
  "admin",
]);

export type StudioRoleInput = z.infer<typeof studioRoleSchema>;

/** Admin invite form / API body. */
export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email is required" })
    .email({ message: "Enter a valid email address" })
    .transform((value) => value.toLowerCase()),
  role: studioRoleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
