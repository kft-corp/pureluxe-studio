import { z } from "zod";

export const BOOKING_SERVICE_TYPES = [
  "hotel",
  "flight",
  "transfer",
  "activity",
] as const;

export const BOOKING_STATUSES = [
  "pending",
  "on_hold",
  "confirmed",
  "cancelled",
  "completed",
  "superseded",
] as const;

/** Full work-queue set (dialog + query). */
export const BOOKING_WORK_FILTERS = [
  "needs_confirm",
  "cancel_soon",
  "depart_soon",
  "arriving",
  "in_house",
] as const;

/** Toolbar quick chips — morning urgency + Mine. */
export const BOOKING_QUICK_FILTERS = [
  "needs_confirm",
  "cancel_soon",
  "depart_soon",
  "arriving",
  "in_house",
  "mine",
] as const;

export const BOOKING_SCOPE_FILTERS = ["mine", "all"] as const;

export type BookingServiceTypeFilter = (typeof BOOKING_SERVICE_TYPES)[number];
export type BookingStatusFilter = (typeof BOOKING_STATUSES)[number];
export type BookingWorkFilter = (typeof BOOKING_WORK_FILTERS)[number];
export type BookingScopeFilter = (typeof BOOKING_SCOPE_FILTERS)[number];
export type BookingQuickFilter = (typeof BOOKING_QUICK_FILTERS)[number];

export const bookingServiceTypeSchema = z.enum(BOOKING_SERVICE_TYPES);
export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const bookingWorkFilterSchema = z.enum(BOOKING_WORK_FILTERS);
export const bookingScopeFilterSchema = z.enum(BOOKING_SCOPE_FILTERS);
export const bookingQuickFilterSchema = z.enum(BOOKING_QUICK_FILTERS);

/** Days ahead for cancel-soon / depart-soon / ticket-deadline work. */
export const BOOKING_CANCEL_SOON_DAYS = 14;
export const BOOKING_DEPART_SOON_DAYS = 7;
export const BOOKING_TICKET_SOON_DAYS = 7;

const bookingTypeQuerySchema = z.enum([
  "any",
  "hotel",
  "flight",
  "transfer",
  "activity",
]);

const bookingWorkQuerySchema = z.enum([
  "any",
  "needs_confirm",
  "cancel_soon",
  "depart_soon",
  "arriving",
  "in_house",
]);

const bookingStatusQuerySchema = z.enum([
  "any",
  "pending",
  "on_hold",
  "confirmed",
  "cancelled",
  "completed",
  "superseded",
]);

const boolFromQuery = z.preprocess((value) => {
  if (value === true || value === "true" || value === "1") return true;
  return false;
}, z.boolean());

const optionalDateQuery = z.preprocess((value) => {
  if (value == null || value === "") return "";
  return String(value).trim();
}, z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Use YYYY-MM-DD for the date range",
  }),
]));

/** Directory list query — search, scope, type, work, status, ops filters, paginate. */
export const listBookingsQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(200, { message: "Search is too long" })
      .optional()
      .default(""),
    scope: bookingScopeFilterSchema.optional().default("mine"),
    /** `any` = all service types. */
    type: bookingTypeQuerySchema.optional().default("any"),
    /** `any` = no work-queue filter. */
    work: bookingWorkQuerySchema.optional().default("any"),
    /** `any` = hide superseded only (cleaner ledger). */
    status: bookingStatusQuerySchema.optional().default("any"),
    /** Active booking with no supplier ref / PNR. */
    missing_ref: boolFromQuery.optional().default(false),
    /** Booking not linked to a trip. */
    no_trip: boolFromQuery.optional().default(false),
    /** Flights whose ticket time limit is within BOOKING_TICKET_SOON_DAYS. */
    ticket_deadline_soon: boolFromQuery.optional().default(false),
    /** any | unassigned | me | team member uuid */
    owner: z
      .string()
      .trim()
      .optional()
      .default("any")
      .transform((value) => value || "any"),
    /** Inclusive start_date range (YYYY-MM-DD). Empty = no bound. */
    start_from: optionalDateQuery.optional().default(""),
    start_to: optionalDateQuery.optional().default(""),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .refine(
    (value) =>
      !value.start_from ||
      !value.start_to ||
      value.start_from <= value.start_to,
    {
      message: "Start from must be on or before Start to.",
      path: ["start_from"],
    },
  );

export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
