import { z } from "zod";

const optionalProfileText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, { message: tooLongMessage })
    .transform((value) => value || null);

/** Self-service profile update — name, designation, and phone. */
export const updateMemberProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(120, { message: "Name is too long" }),
  title: optionalProfileText(120, "Designation is too long"),
  phone: optionalProfileText(32, "Phone number is too long"),
});

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
export type UpdateMemberProfileBody = z.input<typeof updateMemberProfileSchema>;
