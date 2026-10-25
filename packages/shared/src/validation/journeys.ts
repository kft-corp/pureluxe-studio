import { z } from "zod";

import { JOURNEY_TRAVEL_STAGES, JOURNEY_WORK_STAGES } from "../trips/classify-journey";

/** Mine is the signed-in advisor. All is the whole team. */
export const JOURNEY_SCOPES = ["mine", "all"] as const;

/**
 * Board filters.
 * `working` is still planning (building, sent to client, waiting on the client, or booking).
 * Work values match trips.status. Travel values are computed from dates.
 * `any` is the live book (cancelled trips stay on the cancelled filter).
 */
export const JOURNEY_STAGE_FILTERS = [
  "any",
  "working",
  ...JOURNEY_WORK_STAGES,
  ...JOURNEY_TRAVEL_STAGES,
  "cancelled",
] as const;

export const JOURNEY_CLIENT_FILTERS = ["any", "vip", "standard"] as const;
export const JOURNEY_PRICE_FILTERS = ["any", "locked", "open"] as const;
export const JOURNEY_QUOTE_FILTERS = ["any", "stale", "current"] as const;
/** Offline payment tracking on the trip (record-only). */
export const JOURNEY_PAYMENT_FILTERS = [
  "any",
  "not_started",
  "partial",
  "paid",
  "overdue",
] as const;
export const TRIP_PAYMENT_STATUSES = [
  "not_started",
  "partial",
  "paid",
  "overdue",
] as const;

export type JourneyScope = (typeof JOURNEY_SCOPES)[number];
export type JourneyStageFilter = (typeof JOURNEY_STAGE_FILTERS)[number];
export type JourneyClientFilter = (typeof JOURNEY_CLIENT_FILTERS)[number];
export type JourneyPriceFilter = (typeof JOURNEY_PRICE_FILTERS)[number];
export type JourneyQuoteFilter = (typeof JOURNEY_QUOTE_FILTERS)[number];
export type JourneyPaymentFilter = (typeof JOURNEY_PAYMENT_FILTERS)[number];
export type TripPaymentStatus = (typeof TRIP_PAYMENT_STATUSES)[number];

const journeyDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Use a real date.",
  });

/** Directory default page size (UI + API). */
export const JOURNEY_DIRECTORY_PAGE_SIZE = 20;

/** GET /api/trips — portfolio cards, not the Trip Builder switcher. */
export const listJourneysQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100, { message: "Search is too long." })
    .optional()
    .default(""),
  scope: z.enum(JOURNEY_SCOPES).optional().default("mine"),
  stage: z.enum(JOURNEY_STAGE_FILTERS).optional().default("any"),
  client_tier: z.enum(JOURNEY_CLIENT_FILTERS).optional().default("any"),
  price: z.enum(JOURNEY_PRICE_FILTERS).optional().default("any"),
  quote: z.enum(JOURNEY_QUOTE_FILTERS).optional().default("any"),
  payment: z.enum(JOURNEY_PAYMENT_FILTERS).optional().default("any"),
  owner: z.string().trim().max(80).optional().default("any"),
  starts_from: journeyDate.optional().default(""),
  starts_to: journeyDate.optional().default(""),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(JOURNEY_DIRECTORY_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type ListJourneysQuery = z.infer<typeof listJourneysQuerySchema>;

/** POST /api/trips/[id]/status — status changes made on the trip page. */
export const JOURNEY_STATUS_ACTIONS = [
  "send",
  "waiting",
  "accept",
  "reopen",
  "confirm",
  "cancel",
] as const;

export const journeyStatusActionSchema = z.object({
  action: z.enum(JOURNEY_STATUS_ACTIONS),
});

export type JourneyStatusAction = (typeof JOURNEY_STATUS_ACTIONS)[number];

/** PATCH /api/trips/[id]/payment — offline payment tracking (record-only). */
export const updateTripPaymentSchema = z
  .object({
    amount_received: z
      .number()
      .finite()
      .nonnegative()
      .nullable()
      .optional(),
    payment_status: z.enum(TRIP_PAYMENT_STATUSES).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide amount received or payment status.",
  });

export type UpdateTripPaymentBody = z.input<typeof updateTripPaymentSchema>;
export type UpdateTripPaymentInput = z.output<typeof updateTripPaymentSchema>;
