import { z } from "zod";

import { isInternationalPhone } from "../geo/phone";

const optionalProfileText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, { message: tooLongMessage })
    .transform((value) => value || null);

/** Empty / omit → null; otherwise prefer E.164 (+15551234567). */
const optionalInternationalPhone = (tooLongMessage: string) =>
  z
    .union([
      z.literal("").transform(() => null),
      z.null(),
      z
        .string()
        .trim()
        .max(20, { message: tooLongMessage })
        .refine((value) => isInternationalPhone(value), {
          message: "Use an international number with a country code",
        }),
    ])
    .optional();

/** Self-service profile update — name, designation, and phone. */
export const updateMemberProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required" })
    .max(120, { message: "Name is too long" }),
  title: optionalProfileText(120, "Designation is too long"),
  phone: optionalInternationalPhone("Phone number is too long"),
});

export type UpdateMemberProfileInput = z.infer<typeof updateMemberProfileSchema>;
export type UpdateMemberProfileBody = z.input<typeof updateMemberProfileSchema>;
