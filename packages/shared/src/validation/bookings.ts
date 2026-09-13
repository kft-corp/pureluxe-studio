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

export const bookingIdSchema = z
  .string()
  .uuid({ message: "That booking link looks invalid." });

/** Local time of day (HH:mm) — hotel check-in/out style. */
const optionalTimeOfDay = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  const raw = String(value).trim();
  // Accept "15:00" or "15:00:00"
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw);
  if (!match) return raw;
  return `${match[1]}:${match[2]}`;
}, z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: "Use HH:mm for local times (e.g. 15:00).",
  })
  .optional());

/** Date-time string for segments / pickup — ISO preferred, free text allowed. */
const optionalDateTimeText = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return String(value).trim() || undefined;
}, z.string().min(1).max(64).optional());

const optionalText = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
}, z.string().min(1).max(200).optional());

/** Hotel / accommodation payload in bookings.service_details. */
export const hotelServiceDetailsSchema = z
  .object({
    check_in_time: optionalTimeOfDay,
    check_out_time: optionalTimeOfDay,
    room_type: optionalText,
    board_basis: optionalText,
    rate_plan: optionalText,
    special_requests: optionalText,
  })
  .passthrough();

/** One flight segment inside service_details.segments. */
export const flightSegmentSchema = z
  .object({
    airline: optionalText,
    flight_number: optionalText,
    from: optionalText,
    to: optionalText,
    depart_at: optionalDateTimeText,
    arrive_at: optionalDateTimeText,
    cabin: optionalText,
    terminal: optionalText,
  })
  .passthrough();

/** Flight payload in bookings.service_details. */
export const flightServiceDetailsSchema = z
  .object({
    segments: z.array(flightSegmentSchema).optional().default([]),
    ticket_number: optionalText,
    booking_class: optionalText,
  })
  .passthrough();

/** Transfer / ground transport payload. */
export const transferServiceDetailsSchema = z
  .object({
    pickup_at: optionalDateTimeText,
    dropoff_at: optionalDateTimeText,
    pickup_location: optionalText,
    dropoff_location: optionalText,
    meeting_point: optionalText,
    vehicle_type: optionalText,
    driver_name: optionalText,
    driver_phone: optionalText,
  })
  .passthrough();

/** Activity / experience payload. */
export const activityServiceDetailsSchema = z
  .object({
    start_at: optionalDateTimeText,
    end_at: optionalDateTimeText,
    meeting_point: optionalText,
    duration_minutes: z.preprocess((value) => {
      if (value == null || value === "") return undefined;
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? n : undefined;
    }, z.number().int().positive().optional()),
    provider_name: optionalText,
    voucher_ref: optionalText,
  })
  .passthrough();

export type HotelServiceDetails = z.infer<typeof hotelServiceDetailsSchema>;
export type FlightSegment = z.infer<typeof flightSegmentSchema>;
export type FlightServiceDetails = z.infer<typeof flightServiceDetailsSchema>;
export type TransferServiceDetails = z.infer<
  typeof transferServiceDetailsSchema
>;
export type ActivityServiceDetails = z.infer<
  typeof activityServiceDetailsSchema
>;

export type ParsedBookingServiceDetails =
  | { serviceType: "hotel"; details: HotelServiceDetails }
  | { serviceType: "flight"; details: FlightServiceDetails }
  | { serviceType: "transfer"; details: TransferServiceDetails }
  | { serviceType: "activity"; details: ActivityServiceDetails }
  | { serviceType: "unknown"; details: Record<string, unknown> };

/**
 * Soft-parse service_details for display / future writes.
 * Unknown keys are kept (passthrough); invalid shapes fall back to raw object.
 */
export function parseBookingServiceDetails(
  serviceType: string,
  raw: unknown,
): ParsedBookingServiceDetails {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (serviceType === "hotel") {
    const parsed = hotelServiceDetailsSchema.safeParse(base);
    return {
      serviceType: "hotel",
      details: parsed.success ? parsed.data : (base as HotelServiceDetails),
    };
  }
  if (serviceType === "flight") {
    const parsed = flightServiceDetailsSchema.safeParse(base);
    return {
      serviceType: "flight",
      details: parsed.success ? parsed.data : (base as FlightServiceDetails),
    };
  }
  if (serviceType === "transfer") {
    const parsed = transferServiceDetailsSchema.safeParse(base);
    return {
      serviceType: "transfer",
      details: parsed.success
        ? parsed.data
        : (base as TransferServiceDetails),
    };
  }
  if (serviceType === "activity") {
    const parsed = activityServiceDetailsSchema.safeParse(base);
    return {
      serviceType: "activity",
      details: parsed.success
        ? parsed.data
        : (base as ActivityServiceDetails),
    };
  }

  return { serviceType: "unknown", details: base };
}
