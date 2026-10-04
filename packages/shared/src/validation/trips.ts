import { z } from "zod";

export const TRIP_STATUSES = [
  "building",
  "waiting_on_client",
  "booking",
  "confirmed",
  "completed",
  "cancelled",
] as const;

export type TripStatusFilter = (typeof TRIP_STATUSES)[number];

export const tripStatusSchema = z.enum(TRIP_STATUSES);

export const tripIdSchema = z.string().uuid({
  message: "Choose a valid trip.",
});

const optionalUuid = z
  .union([z.string().uuid(), z.literal(""), z.null()])
  .optional()
  .transform((value) => value || null);

const optionalTitle = z
  .string()
  .trim()
  .max(200, { message: "Keep the title under 200 characters." })
  .optional()
  .nullable()
  .transform((value) => value || null);

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use dates as YYYY-MM-DD." });

/** GET /api/trip-builder/trips — always scoped to the signed-in owner. */
export const listTripsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || undefined),
  status: z
    .enum(["any", ...TRIP_STATUSES])
    .optional()
    .default("any"),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListTripsQuery = z.infer<typeof listTripsQuerySchema>;

/** POST /api/trip-builder/trips */
export const createTripSchema = z.object({
  primary_client_id: optionalUuid,
  title: optionalTitle,
});

export type CreateTripBody = z.input<typeof createTripSchema>;
export type CreateTripInput = z.output<typeof createTripSchema>;

/** PATCH /api/trip-builder/trips/[id] — Phase 1 shell fields only. */
export const updateTripSchema = z
  .object({
    primary_client_id: optionalUuid,
    title: optionalTitle,
    status: tripStatusSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update.",
  });

export type UpdateTripBody = z.input<typeof updateTripSchema>;
export type UpdateTripInput = z.output<typeof updateTripSchema>;

/**
 * POST /api/trip-builder/trips/[id]/stay
 * Phase 1 fixed stay: hotel + city + dates on the first leg.
 */
export const setTripStaySchema = z
  .object({
    city: z
      .string()
      .trim()
      .min(1, { message: "Enter a city or destination." })
      .max(200, { message: "Keep the city under 200 characters." }),
    check_in: isoDate,
    check_out: isoDate,
    property_id: optionalUuid,
    property_name: z
      .string()
      .trim()
      .max(200, { message: "Keep the hotel name under 200 characters." })
      .optional()
      .nullable()
      .transform((value) => value || null),
    destination_profile_id: optionalUuid,
  })
  .refine((body) => body.check_out > body.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  })
  .refine((body) => Boolean(body.property_id || body.property_name), {
    message: "Choose a hotel (or enter a hotel name) for the stay.",
    path: ["property_name"],
  });

export type SetTripStayBody = z.input<typeof setTripStaySchema>;
export type SetTripStayInput = z.output<typeof setTripStaySchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => value || null);

/**
 * PATCH /api/trip-builder/trips/[id]/quote
 * Quote draft / edit — narrative overlay + optional sell fields.
 */
export const updateTripQuoteSchema = z
  .object({
    title: optionalText(200),
    intro: optionalText(4000),
    notes: optionalText(4000),
    highlights: z
      .array(z.string().trim().min(1).max(200))
      .max(20)
      .optional(),
    sell_total: z
      .number()
      .finite()
      .nonnegative()
      .optional()
      .nullable(),
    sell_currency: z
      .string()
      .trim()
      .length(3)
      .optional()
      .nullable()
      .transform((value) => (value ? value.toUpperCase() : null)),
    payment_plan: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one quote field to update.",
  });

export type UpdateTripQuoteBody = z.input<typeof updateTripQuoteSchema>;
export type UpdateTripQuoteInput = z.output<typeof updateTripQuoteSchema>;

/** POST /api/trip-builder/trips/[id]/quote/generate */
export const generateTripQuoteSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type GenerateTripQuoteBody = z.input<typeof generateTripQuoteSchema>;
export type GenerateTripQuoteInput = z.output<typeof generateTripQuoteSchema>;
