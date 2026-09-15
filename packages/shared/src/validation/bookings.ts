import { z } from "zod";

import { isValidCurrencyCode } from "../geo/currencies";

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

const optionalNullableText = (max: number, tooLongMessage: string) =>
  z
    .string()
    .trim()
    .max(max, { message: tooLongMessage })
    .transform((value) => value || null);

const optionalDate = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: "Use YYYY-MM-DD for dates",
      }),
  ])
  .optional();

const optionalDateTime = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .min(1, { message: "Enter a date and time" })
      .max(64, { message: "Date/time is too long" }),
  ])
  .optional();

const optionalNonNegativeInt = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().int().min(0).nullable().optional());

const optionalMoney = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().finite().nullable().optional());

/** Statuses editable via Policy PATCH — confirm / cancel / amend stay on toolbar actions. */
export const BOOKING_EDITABLE_STATUSES = [
  "pending",
  "on_hold",
  "completed",
] as const;

export const bookingEditableStatusSchema = z.enum(BOOKING_EDITABLE_STATUSES);

/**
 * Soft service_details patch — unknown keys kept; empty strings cleared.
 * Domain merges into the existing jsonb blob.
 */
export const bookingServiceDetailsPatchSchema = z
  .record(z.string(), z.unknown())
  .optional();

/** Studio PATCH whitelist — ops fields advisors edit after Trip Builder Book. */
const bookingWritableObjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "Enter a booking title." })
    .max(200, { message: "Title is too long" }),
  hotel_name: optionalNullableText(200, "Property name is too long")
    .nullable()
    .optional(),
  city: optionalNullableText(120, "City is too long").nullable().optional(),
  country: optionalNullableText(120, "Country is too long").nullable().optional(),
  chain: optionalNullableText(120, "Chain is too long").nullable().optional(),
  start_date: optionalDate,
  end_date: optionalDate,
  nights: optionalNonNegativeInt,
  num_rooms: optionalNonNegativeInt,
  num_adults: optionalNonNegativeInt,
  num_children: optionalNonNegativeInt,
  supplier_name: optionalNullableText(200, "Supplier name is too long")
    .nullable()
    .optional(),
  supplier_ref: optionalNullableText(120, "Confirmation / PNR is too long")
    .nullable()
    .optional(),
  booking_channel: optionalNullableText(80, "Booking channel is too long")
    .nullable()
    .optional(),
  currency: z
    .union([
      z.literal("").transform(() => null),
      z.null(),
      z
        .string()
        .trim()
        .transform((value) => value.toUpperCase())
        .refine((value) => isValidCurrencyCode(value), {
          message: "Choose a currency from the list",
        }),
    ])
    .optional(),
  cost_amount: optionalMoney,
  sell_amount: optionalMoney,
  commission_expected: optionalMoney,
  status: bookingEditableStatusSchema.optional(),
  cancellation_reason: optionalNullableText(
    2000,
    "Cancellation reason is too long",
  )
    .nullable()
    .optional(),
  cancellation_deadline: optionalDate,
  cancellation_policy: optionalNullableText(
    5000,
    "Cancellation policy is too long",
  )
    .nullable()
    .optional(),
  ticket_time_limit: optionalDateTime,
  internal_notes: optionalNullableText(5000, "Internal notes are too long")
    .nullable()
    .optional(),
  vip_flag: z.boolean().optional(),
  service_details: bookingServiceDetailsPatchSchema,
});

/** PATCH whitelist — shapes only; date/status rules applied after merge in domain. */
export const updateBookingSchema = bookingWritableObjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type UpdateBookingBody = z.input<typeof updateBookingSchema>;

const optionalUuid = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z.string().uuid({ message: "Choose a valid option" }),
  ])
  .optional();

/** Confirm — optional ref / deadlines filled at confirm time. */
export const confirmBookingSchema = z.object({
  supplier_ref: optionalNullableText(120, "Confirmation / PNR is too long")
    .nullable()
    .optional(),
  cancellation_deadline: optionalDate,
  ticket_time_limit: optionalDateTime,
});

export type ConfirmBookingInput = z.infer<typeof confirmBookingSchema>;
export type ConfirmBookingBody = z.input<typeof confirmBookingSchema>;

/** Cancel — reason required for ops clarity. */
export const cancelBookingSchema = z.object({
  cancellation_reason: z
    .string()
    .trim()
    .min(1, { message: "Add a cancellation reason." })
    .max(2000, { message: "Cancellation reason is too long" }),
});

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;
export type CancelBookingBody = z.input<typeof cancelBookingSchema>;

/** Assign relationship owner. */
export const assignBookingOwnerSchema = z.object({
  relationship_owner_id: z
    .union([
      z.null(),
      z.string().uuid({ message: "Choose a valid team member" }),
    ]),
});

export type AssignBookingOwnerInput = z.infer<typeof assignBookingOwnerSchema>;
export type AssignBookingOwnerBody = z.input<typeof assignBookingOwnerSchema>;

/** Link / unlink trip from Context. */
export const linkBookingTripSchema = z
  .object({
    trip_id: optionalUuid,
    trip_leg_id: optionalUuid,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type LinkBookingTripInput = z.infer<typeof linkBookingTripSchema>;
export type LinkBookingTripBody = z.input<typeof linkBookingTripSchema>;

export const BOOKING_TRAVELLER_ROLES = [
  "lead",
  "adult",
  "child",
  "infant",
] as const;

export const BOOKING_TRAVELLER_GENDERS = [
  "male",
  "female",
  "unspecified",
] as const;

export const bookingTravellerRoleSchema = z.enum(BOOKING_TRAVELLER_ROLES);
export const bookingTravellerGenderSchema = z.enum(BOOKING_TRAVELLER_GENDERS);

const travellerWritableObjectSchema = z.object({
  client_id: optionalUuid,
  title: optionalNullableText(40, "Title is too long").nullable().optional(),
  full_name: z
    .string()
    .trim()
    .min(1, { message: "Enter the traveller's name." })
    .max(200, { message: "Name is too long" }),
  gender: bookingTravellerGenderSchema.nullable().optional(),
  role: bookingTravellerRoleSchema.optional().default("adult"),
  date_of_birth: optionalDate,
  passport_number: optionalNullableText(80, "Passport number is too long")
    .nullable()
    .optional(),
  passport_nationality: optionalNullableText(
    80,
    "Passport nationality is too long",
  )
    .nullable()
    .optional(),
  passport_expiry: optionalDate,
});

export const createBookingTravellerSchema = travellerWritableObjectSchema;

export const updateBookingTravellerSchema = travellerWritableObjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type CreateBookingTravellerInput = z.infer<
  typeof createBookingTravellerSchema
>;
export type CreateBookingTravellerBody = z.input<
  typeof createBookingTravellerSchema
>;
export type UpdateBookingTravellerInput = z.infer<
  typeof updateBookingTravellerSchema
>;
export type UpdateBookingTravellerBody = z.input<
  typeof updateBookingTravellerSchema
>;

export const bookingTravellerIdSchema = z
  .string()
  .uuid({ message: "That traveller link looks invalid." });

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
