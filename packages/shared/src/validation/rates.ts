import { z } from "zod";

const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

/** POST /api/trip-builder/rates/search */
export const searchRatesBodySchema = z
  .object({
    trip_id: optionalUuid,
    leg_id: optionalUuid,
    destination_text: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((value) => value || null),
    property_id: optionalUuid,
    check_in: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use check-in as YYYY-MM-DD." }),
    check_out: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use check-out as YYYY-MM-DD." }),
    adults: z.coerce.number().int().min(1).max(20).default(2),
    children: z.coerce.number().int().min(0).max(20).optional().default(0),
    rooms: z.coerce.number().int().min(1).max(20).optional().default(1),
    currency: z
      .string()
      .trim()
      .length(3)
      .optional()
      .transform((value) => (value ? value.toUpperCase() : undefined)),
    paste_text: z
      .string()
      .max(50_000)
      .optional()
      .nullable()
      .transform((value) => value?.trim() || null),
  })
  .refine((body) => body.check_out > body.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  });

export type SearchRatesBody = z.infer<typeof searchRatesBodySchema>;

/** POST /api/trip-builder/line-items/paste */
export const pasteLineItemBodySchema = z
  .object({
    trip_id: z.string().uuid({ message: "Choose a trip." }),
    leg_id: optionalUuid,
    property_id: optionalUuid,
    property_name: z
      .string()
      .trim()
      .max(200)
      .optional()
      .nullable()
      .transform((value) => value || null),
    check_in: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use check-in as YYYY-MM-DD." }),
    check_out: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use check-out as YYYY-MM-DD." }),
    currency: z
      .string()
      .trim()
      .length(3)
      .optional()
      .transform((value) => (value ? value.toUpperCase() : "USD")),
    paste_text: z
      .string()
      .trim()
      .min(1, { message: "Paste some quote text before saving." })
      .max(50_000),
    title: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) => value || undefined),
  })
  .refine((body) => body.check_out > body.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  });

export type PasteLineItemBody = z.infer<typeof pasteLineItemBodySchema>;

export const tripLineItemIdSchema = z.string().uuid({
  message: "Choose a valid line item.",
});

/** PATCH /api/settings/rate-sources — partial company rate_sources jsonb. */
export const updateRateSourcesSettingSchema = z.object({
  default_currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  allow_offline_paste: z.boolean().optional(),
  gds_undercut_pct: z.number().min(0).max(100).optional(),
  always_surface_negotiated_gds: z.boolean().optional(),
  offline_availability_check: z.boolean().optional(),
  sources: z
    .object({
      gds_public: z.object({ enabled: z.boolean() }).optional(),
      gds_negotiated: z.object({ enabled: z.boolean() }).optional(),
      ota_bedbank: z.object({ enabled: z.boolean() }).optional(),
      wholesale: z.object({ enabled: z.boolean() }).optional(),
      offline_contracted: z.object({ enabled: z.boolean() }).optional(),
      offline_manual: z.object({ enabled: z.boolean() }).optional(),
    })
    .optional(),
});

export type UpdateRateSourcesSettingBody = z.infer<
  typeof updateRateSourcesSettingSchema
>;
