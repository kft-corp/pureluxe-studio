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

const rateSourceCodeSchema = z.enum([
  "gds_public",
  "gds_negotiated",
  "ota_bedbank",
  "wholesale",
  "offline_contracted",
  "offline_manual",
]);

/** One normalized search option — same shape as @pureluxe/rates options. */
export const normalizedRateOptionSchema = z.object({
  property_id: optionalUuid,
  property_name: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => value || null),
  room_name: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((value) => value || null),
  board: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional()
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
    .transform((value) => value.toUpperCase()),
  cost_internal: z.number().finite().nonnegative(),
  rate_source_code: rateSourceCodeSchema,
  inclusions: z.array(z.string().trim().max(200)).default([]),
  cancellation_summary: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => value || null),
  payment_summary: z
    .string()
    .trim()
    .max(2000)
    .nullable()
    .optional()
    .transform((value) => value || null),
  availability_status: z
    .enum(["available", "on_request", "unknown", "unavailable"])
    .default("unknown"),
  recommended: z.boolean().default(false),
  raw: z.record(z.string(), z.unknown()).default({}),
});

export type NormalizedRateOptionBody = z.infer<typeof normalizedRateOptionSchema>;

/**
 * POST /api/trip-builder/line-items/from-rate
 * Persist a search option onto the trip (optionally select it).
 */
export const addRateOptionBodySchema = z
  .object({
    trip_id: z.string().uuid({ message: "Choose a trip." }),
    leg_id: optionalUuid,
    option: normalizedRateOptionSchema,
    select: z.boolean().optional().default(false),
  })
  .refine((body) => body.option.check_out > body.option.check_in, {
    message: "Check-out must be after check-in.",
    path: ["option", "check_out"],
  });

export type AddRateOptionBody = z.input<typeof addRateOptionBodySchema>;
export type AddRateOptionInput = z.output<typeof addRateOptionBodySchema>;

/** PATCH /api/trip-builder/line-items/[id] — client-facing option edits. */
export const updateStayOptionSchema = z
  .object({
    sell_amount: z.number().finite().nonnegative().nullable().optional(),
    /** Team cost for the room, for example today's hotel price after the client accepted. */
    cost_internal: z.number().finite().positive().optional(),
    cancellation_policy: z.string().trim().max(2000).nullable().optional(),
    inclusions: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: "Provide a price, cost, inclusions, or cancellation to update.",
  });

export type UpdateStayOptionBody = z.input<typeof updateStayOptionSchema>;
export type UpdateStayOptionInput = z.output<typeof updateStayOptionSchema>;

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
