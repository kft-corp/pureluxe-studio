import { z } from "zod";

export const TRIP_STATUSES = [
  "building",
  "quote_sent",
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
  .transform((value) => {
    if (value === undefined) return undefined;
    return value || null;
  });

const optionalTitle = z
  .string()
  .trim()
  .max(200, { message: "Keep the title under 200 characters." })
  .optional()
  .nullable()
  .transform((value) => {
    if (value === undefined) return undefined;
    return value || null;
  });

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
    starts_on: isoDate.optional(),
    ends_on: isoDate.optional(),
    /** Mark the stay list finished so hotel planning can start. */
    confirm_legs: z.boolean().optional(),
    /** Drop stays that fall outside the new trip dates, then save those dates. */
    drop_outside_legs: z.boolean().optional(),
    /** Lock stay, rate, and sell edits after a ready quote PDF. */
    lock_pricing: z.literal(true).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update.",
  })
  .refine(
    (body) =>
      (body.starts_on == null && body.ends_on == null) ||
      (body.starts_on != null && body.ends_on != null && body.ends_on > body.starts_on),
    {
      message: "Trip check-out must be after check-in.",
      path: ["ends_on"],
    },
  );

export type UpdateTripBody = z.input<typeof updateTripSchema>;
export type UpdateTripInput = z.output<typeof updateTripSchema>;

/** POST /api/trip-builder/trips/[id]/shift — move the trip and every stay by the same days. */
export const shiftTripDatesSchema = z.object({
  days: z
    .number()
    .int()
    .min(-365)
    .max(365)
    .refine((value) => value !== 0, { message: "Shift by at least one day." }),
});

export type ShiftTripDatesBody = z.input<typeof shiftTripDatesSchema>;

/**
 * POST /api/trip-builder/trips/[id]/stay
 * Hotel + city + dates on one stay.
 * leg_id updates that stay. Omit it to write the first stay.
 */
export const setTripStaySchema = z
  .object({
    leg_id: optionalUuid,
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
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(20),
    rooms: z.number().int().min(1).max(20),
    /** Save even when the nights overlap another stay. */
    confirm_overlap: z.boolean().optional().default(false),
  })
  .refine((body) => body.check_out > body.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  })
  .refine((body) => Boolean(body.property_id || body.property_name), {
    message: "Choose a hotel (or enter a hotel name) for the stay.",
    path: ["property_name"],
  });

export const addTripTravellerSchema = z.object({
  client_id: z.string().uuid({ message: "Choose a client." }),
  party_role: z.enum(["adult", "child"]).optional().default("adult"),
});

export type AddTripTravellerBody = z.input<typeof addTripTravellerSchema>;
export type AddTripTravellerInput = z.output<typeof addTripTravellerSchema>;

export type SetTripStayBody = z.input<typeof setTripStaySchema>;
export type SetTripStayInput = z.output<typeof setTripStaySchema>;

/** POST /api/trip-builder/trips/[id]/legs — another stay, hotel comes later. */
export const addTripLegSchema = z
  .object({
    city: z
      .string()
      .trim()
      .min(1, { message: "Enter a city or destination." })
      .max(200, { message: "Keep the city under 200 characters." }),
    check_in: isoDate,
    check_out: isoDate,
    /** Add even when the nights overlap another stay. */
    confirm_overlap: z.boolean().optional().default(false),
  })
  .refine((body) => body.check_out > body.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  });

export type AddTripLegBody = z.input<typeof addTripLegSchema>;
export type AddTripLegInput = z.output<typeof addTripLegSchema>;

/** PATCH /api/trip-builder/trips/[id]/legs/[legId] — city and dates on one stay. */
export const updateTripLegSchema = z
  .object({
    city: z
      .string()
      .trim()
      .min(1, { message: "Enter a city or destination." })
      .max(200, { message: "Keep the city under 200 characters." }),
    check_in: isoDate,
    check_out: isoDate,
    confirm_overlap: z.boolean().optional().default(false),
  })
  .refine((body) => body.check_out > body.check_in, {
    message: "Check-out must be after check-in.",
    path: ["check_out"],
  });

export type UpdateTripLegBody = z.input<typeof updateTripLegSchema>;
export type UpdateTripLegInput = z.output<typeof updateTripLegSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => {
      if (value === undefined) return undefined;
      return value || null;
    });

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
      .transform((value) => {
        if (value === undefined) return undefined;
        return value ? value.toUpperCase() : null;
      }),
    payment_plan: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one quote field to update.",
  });

export type UpdateTripQuoteBody = z.input<typeof updateTripQuoteSchema>;
export type UpdateTripQuoteInput = z.output<typeof updateTripQuoteSchema>;

/** POST /api/trip-builder/trips/[id]/options/generate */
export const generateTripQuoteSchema = z.object({
  force: z.boolean().optional().default(false),
});

export type GenerateTripQuoteBody = z.input<typeof generateTripQuoteSchema>;
export type GenerateTripQuoteInput = z.output<typeof generateTripQuoteSchema>;

const optionsLineEditSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9:_-]{1,120}$/i, { message: "Choose a line on the options quote." }),
  text: z.string().max(2000, { message: "Keep that line under 2000 characters." }),
});

/** PATCH /api/trip-builder/trips/[id]/options */
export const updateOptionsQuoteSchema = z
  .object({
    title: optionalText(200),
    notes: optionalText(4000),
    line_edits: z.array(optionsLineEditSchema).max(40).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide a title, a note, or a line to update.",
  });

/** POST /api/trip-builder/trips/[id]/options/edit */
export const proposeOptionsQuoteEditSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export type UpdateOptionsQuoteBody = z.input<typeof updateOptionsQuoteSchema>;
export type UpdateOptionsQuoteInput = z.output<typeof updateOptionsQuoteSchema>;

/**
 * GET /api/trip-builder/trips/[id]/chat
 * Recent-first page of studio chat messages.
 */
export const tripBuilderChatListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  before: z.string().trim().min(1).max(64).optional(),
});

export type TripBuilderChatListQuery = z.output<
  typeof tripBuilderChatListQuerySchema
>;

const chatClientRequestIdSchema = z
  .string()
  .trim()
  .min(8, { message: "Missing send key." })
  .max(128, { message: "Send key is too long." });

/** Short text shown in chat for a button tap or an approval. */
const chatActionLabelSchema = z
  .string()
  .trim()
  .min(1, { message: "Missing button label." })
  .max(200, { message: "Button label is too long." });

/** Agent action name, e.g. history_search_trips. */
const chatActionNameSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,63}$/, { message: "Unknown action." });

const tripBuilderChatSendUnion = z.discriminatedUnion("kind", [
  /** Typed message: the agent decides what to do. */
  z.object({
    kind: z.literal("message"),
    message: z
      .string()
      .trim()
      .min(1, { message: "Enter a message." })
      .max(4000, { message: "Keep the message under 4000 characters." }),
    client_request_id: chatClientRequestIdSchema,
  }),
  /** Button tap: runs that action directly, never read as typed text. */
  z.object({
    kind: z.literal("action"),
    action: chatActionNameSchema,
    args: z.record(z.unknown()).optional().default({}),
    label: chatActionLabelSchema,
    client_request_id: chatClientRequestIdSchema,
  }),
  /** Confirm or Cancel on an approval card: the paused agent continues. */
  z.object({
    kind: z.literal("resume"),
    decision: z.enum(["approve", "cancel"]),
    label: chatActionLabelSchema,
    client_request_id: chatClientRequestIdSchema,
  }),
]);

/**
 * POST /api/trip-builder/trips/[id]/chat
 * Persist the advisor turn + stream the assistant reply (NDJSON).
 * A body without `kind` is a typed message (older clients).
 */
export const tripBuilderChatSendSchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("kind" in value)
      ? { ...value, kind: "message" }
      : value,
  tripBuilderChatSendUnion,
);

const tripChatLineSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    /** action = a chip tap; content is its label. */
    kind: z.enum(["text", "action"]).optional().default("text"),
    /** Chip or action id for an action line. */
    action: z.string().trim().min(1).max(64).optional(),
    content: z
      .string()
      .trim()
      .min(1, { message: "Enter a message." })
      .max(8000, { message: "Keep the message under 8000 characters." }),
  })
  .refine((line) => line.kind === "text" || (line.role === "user" && Boolean(line.action)), {
    message: "An action line needs the advisor role and an action id.",
    path: ["action"],
  });

/** Save chat lines onto a trip without starting an agent turn. */
export const tripBuilderChatLinesSchema = z.object({
  lines: z.array(tripChatLineSchema).min(1).max(40),
});

export type TripBuilderChatLinesBody = z.input<typeof tripBuilderChatLinesSchema>;
export type TripBuilderChatLinesInput = z.output<typeof tripBuilderChatLinesSchema>;

export type TripBuilderChatSendBody = z.input<typeof tripBuilderChatSendUnion>;
export type TripBuilderChatSendInput = z.output<typeof tripBuilderChatSendUnion>;

const chatHistoryMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1)
    .max(4000, { message: "Keep each history message under 4000 characters." }),
});

const homeChatHistorySchema = z.array(chatHistoryMessageSchema).max(40).optional().default([]);

const tripBuilderPreTripChatSendUnion = z.discriminatedUnion("kind", [
  /** Typed message. */
  z.object({
    kind: z.literal("message"),
    message: z
      .string()
      .trim()
      .min(1, { message: "Enter a message." })
      .max(4000, { message: "Keep the message under 4000 characters." }),
    history: homeChatHistorySchema,
    client_request_id: chatClientRequestIdSchema,
  }),
  /** Button tap, e.g. "Create trip · Ravi Mehta". */
  z.object({
    kind: z.literal("action"),
    action: chatActionNameSchema,
    args: z.record(z.unknown()).optional().default({}),
    label: chatActionLabelSchema,
    history: homeChatHistorySchema,
    client_request_id: chatClientRequestIdSchema,
  }),
]);

/**
 * POST /api/trip-builder/pre-trip/chat
 * Home chat (no trip open). Nothing is saved until it creates a trip.
 * A body without `kind` is a typed message (older clients).
 */
export const tripBuilderPreTripChatSendSchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("kind" in value)
      ? { ...value, kind: "message" }
      : value,
  tripBuilderPreTripChatSendUnion,
);

export type TripBuilderPreTripChatSendBody = z.input<typeof tripBuilderPreTripChatSendUnion>;
export type TripBuilderPreTripChatSendInput = z.output<typeof tripBuilderPreTripChatSendUnion>;
