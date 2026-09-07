import { z } from "zod";

import { isValidCountryCode, normalizeCountryCode } from "../geo/countries";
import {
  isValidLanguageCode,
  normalizeLanguageCode,
} from "../geo/languages";
import { isInternationalPhone } from "../geo/phone";
import { isValidTimezone, normalizeTimezone } from "../geo/timezones";

const optionalText = (max: number, tooLongMessage: string) =>
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

/** Empty / omit → null; otherwise require ISO 3166-1 alpha-2. */
const optionalCountryCode = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .refine((value) => isValidCountryCode(value), {
        message: "Choose a country from the list",
      })
      .transform((value) => normalizeCountryCode(value)),
  ])
  .optional();

/** Empty / omit → null; otherwise require ISO 639-1 language code. */
const optionalLanguage = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .refine((value) => isValidLanguageCode(value), {
        message: "Choose a language from the list",
      })
      .transform((value) => normalizeLanguageCode(value)),
  ])
  .optional();

/** Empty / omit → null; otherwise require IANA timezone. */
const optionalTimezone = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .refine((value) => isValidTimezone(value), {
        message: "Choose a timezone from the list",
      })
      .transform((value) => normalizeTimezone(value)),
  ])
  .optional();

/** Empty string or omit → null; otherwise validate email. */
const optionalEmail = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .max(254, { message: "Email is too long" })
      .email({ message: "Enter a valid email address" })
      .transform((value) => value.toLowerCase()),
  ])
  .optional();

export const clientVipTierSchema = z.enum(["standard", "vip", "vvip"], {
  errorMap: () => ({ message: "Choose a valid guest tier" }),
});

/** @deprecated Prefer tier_id / resolving default — kept as slug for filters & forms. */
export const clientTierSlugSchema = clientVipTierSchema;

export const preferredContactMethodSchema = z.enum(
  ["email", "phone", "whatsapp"],
  {
    errorMap: () => ({ message: "Choose a preferred contact method" }),
  },
);

export const importantDateSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, { message: "Date label is required" })
    .max(80, { message: "Date label is too long" }),
  date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use YYYY-MM-DD for dates" }),
  recurring: z.boolean().optional().default(false),
});

export const clientIdSchema = z
  .string()
  .uuid({ message: "That client link looks invalid." });

/** Quick chips on the directory (Me is always last in the UI). */
export const CLIENT_QUICK_FILTERS = [
  "has_family",
  "missing_contact",
  "mine",
] as const;

export type ClientQuickFilter = (typeof CLIENT_QUICK_FILTERS)[number];

export const clientQuickFilterSchema = z.enum(CLIENT_QUICK_FILTERS);

/** @deprecated Use ClientQuickFilter — kept for older imports. */
export type ClientDirectoryFilter = ClientQuickFilter;
export const CLIENT_DIRECTORY_FILTERS = CLIENT_QUICK_FILTERS;
export const clientDirectoryFilterSchema = clientQuickFilterSchema;

export const CLIENT_SOURCES = [
  "studio",
  "trip_builder",
  "client_app",
  "import",
] as const;

export type ClientSourceFilter = (typeof CLIENT_SOURCES)[number];

/** Panel dropdown — Any or a specific VIP tier. */
export const clientTierFilterSchema = z.enum([
  "any",
  "standard",
  "vip",
  "vvip",
]);

/** Panel dropdown — Any or a review status. */
export const clientReviewStatusFilterSchema = z.enum([
  "any",
  "pending",
  "approved",
]);

export const clientCompletenessFilterSchema = z.enum([
  "any",
  "under_25",
  "under_50",
  "under_75",
  "complete",
]);

const optionalDateQuery = z.preprocess((value) => {
  if (value == null || value === "") return "";
  return String(value).trim();
}, z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Use YYYY-MM-DD for the date range",
  }),
]));

function parseQuickFilters(raw: unknown): ClientQuickFilter[] {
  const values: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") values.push(...item.split(","));
    }
  } else if (typeof raw === "string") {
    values.push(...raw.split(","));
  }

  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value): value is ClientQuickFilter =>
          (CLIENT_QUICK_FILTERS as readonly string[]).includes(value),
        ),
    ),
  ];
}

function parseSources(raw: unknown): ClientSourceFilter[] {
  const values: string[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") values.push(...item.split(","));
    }
  } else if (typeof raw === "string") {
    values.push(...raw.split(","));
  }

  return [
    ...new Set(
      values
        .map((value) => value.trim())
        .filter((value): value is ClientSourceFilter =>
          (CLIENT_SOURCES as readonly string[]).includes(value),
        ),
    ),
  ];
}

const boolFromQuery = z.preprocess((value) => {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0" || value === "" || value == null) {
    return false;
  }
  return false;
}, z.boolean());

/** Directory list query — chips + advanced panel fields. */
export const listClientsQuerySchema = z
  .object({
    q: z
      .string()
      .trim()
      .max(200, { message: "Search is too long" })
      .optional()
      .default(""),
    filters: z.preprocess(parseQuickFilters, z.array(clientQuickFilterSchema)),
    /** Panel tier wins over chips when not "any". */
    tier: clientTierFilterSchema.optional().default("any"),
    review_status: clientReviewStatusFilterSchema.optional().default("any"),
    has_family: boolFromQuery.optional().default(false),
    missing_contact: boolFromQuery.optional().default(false),
    /** any | unassigned | me | team member uuid */
    owner: z
      .string()
      .trim()
      .optional()
      .default("any")
      .transform((value) => value || "any"),
    sources: z.preprocess(parseSources, z.array(z.enum(CLIENT_SOURCES))),
    completeness: clientCompletenessFilterSchema.optional().default("any"),
    /** Inclusive created_at range (YYYY-MM-DD). Empty = no bound. */
    created_from: optionalDateQuery.optional().default(""),
    created_to: optionalDateQuery.optional().default(""),
    sort: z
      .enum([
        "name_asc",
        "name_desc",
        "last_booking_desc",
        "spend_desc",
        "created_desc",
      ])
      .optional()
      .default("name_asc"),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    offset: z.coerce.number().int().min(0).optional().default(0),
  })
  .refine(
    (value) =>
      !value.created_from ||
      !value.created_to ||
      value.created_from <= value.created_to,
    {
      message: "Created from must be on or before Created to.",
      path: ["created_from"],
    },
  );

export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

/** Autocomplete — keep payload tiny for mid-call / Trip Builder. */
export const searchClientsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, { message: "Type a name, email, or phone to search" })
    .max(200, { message: "Search is too long" }),
  limit: z.coerce.number().int().min(1).max(10).optional().default(10),
});

export type SearchClientsQuery = z.infer<typeof searchClientsQuerySchema>;

const clientWritableObjectSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, { message: "Enter the client's name." })
    .max(200, { message: "Name is too long" }),
  title: optionalText(40, "Title is too long").nullable().optional(),
  first_name: optionalText(100, "First name is too long").nullable().optional(),
  last_name: optionalText(100, "Last name is too long").nullable().optional(),
  legal_name: optionalText(200, "Legal name is too long").nullable().optional(),
  email: optionalEmail,
  phone: optionalInternationalPhone("Phone number is too long"),
  whatsapp: optionalInternationalPhone("WhatsApp number is too long"),
  preferred_contact_method: preferredContactMethodSchema.nullable().optional(),
  preferred_language: optionalLanguage,
  timezone: optionalTimezone,
  nationality: optionalCountryCode,
  city_of_residence: optionalText(120, "City is too long").nullable().optional(),
  company: optionalText(160, "Company is too long").nullable().optional(),
  address_line_1: optionalText(200, "Address is too long").nullable().optional(),
  address_line_2: optionalText(200, "Address line 2 is too long")
    .nullable()
    .optional(),
  address_city: optionalText(120, "City is too long").nullable().optional(),
  address_state: optionalText(120, "State is too long").nullable().optional(),
  address_postal_code: optionalText(32, "Postal code is too long")
    .nullable()
    .optional(),
  address_country: optionalCountryCode,
  relationship_owner_id: z
    .string()
    .uuid({ message: "Choose a valid team member" })
    .nullable()
    .optional(),
  /** Preferred: UUID from client_tiers. */
  tier_id: z
    .string()
    .uuid({ message: "Choose a valid guest tier" })
    .optional(),
  /** Optional slug shortcut (standard | vip | vvip). Ignored if tier_id is set. */
  tier_slug: clientTierSlugSchema.optional(),
  client_since: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use YYYY-MM-DD for client since" })
    .nullable()
    .optional(),
  referred_by_client_id: z
    .string()
    .uuid({ message: "Choose a valid referring client" })
    .nullable()
    .optional(),
  important_dates: z.array(importantDateSchema).optional(),
  guest_notes: optionalText(5000, "Guest notes are too long").nullable().optional(),
  internal_notes: optionalText(5000, "Internal notes are too long")
    .nullable()
    .optional(),
  avatar_url: optionalText(2048, "Avatar URL is too long").nullable().optional(),
});

function assertEmailOrPhone(
  value: { email?: string | null; phone?: string | null },
  ctx: z.RefinementCtx,
) {
  if (!value.email && !value.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Add an email or phone number so we can reach them.",
      path: ["email"],
    });
  }
}

/** Studio New client — email or phone required. Starts pending until approved. */
export const createClientSchema = clientWritableObjectSchema.superRefine(
  assertEmailOrPhone,
);

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type CreateClientBody = z.input<typeof createClientSchema>;

/** PATCH whitelist — shapes only; contact rule applied after merge in domain. */
export const updateClientSchema = clientWritableObjectSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type UpdateClientBody = z.input<typeof updateClientSchema>;

/** Upsert health profile for a client. */
export const upsertClientHealthSchema = z.object({
  dietary_restrictions: z
    .array(z.string().trim().min(1).max(80))
    .max(30)
    .optional()
    .default([]),
  mobility_notes: optionalText(2000, "Mobility notes are too long")
    .nullable()
    .optional(),
  medication_notes: optionalText(2000, "Medication notes are too long")
    .nullable()
    .optional(),
  emergency_contact_name: optionalText(120, "Emergency contact name is too long")
    .nullable()
    .optional(),
  emergency_contact_phone: optionalInternationalPhone(
    "Emergency contact phone is too long",
  ),
  share_with_hotels: z.boolean().optional().default(false),
  notes: optionalText(5000, "Health notes are too long").nullable().optional(),
});

export type UpsertClientHealthInput = z.infer<typeof upsertClientHealthSchema>;
export type UpsertClientHealthBody = z.input<typeof upsertClientHealthSchema>;

/** Preference categories shown in Studio (DB stores free text). */
export const CLIENT_PREFERENCE_CATEGORIES = [
  "room",
  "dining",
  "airline",
  "activity",
  "hotel_style",
  "communication",
  "other",
] as const;

export const clientPreferenceCategorySchema = z.enum(
  CLIENT_PREFERENCE_CATEGORIES,
);

export const clientPreferenceSentimentSchema = z.enum([
  "prefer",
  "avoid",
  "require",
]);

export const CLIENT_FAMILY_MEMBER_ROLES = [
  "primary",
  "spouse",
  "partner",
  "child",
  "parent",
  "member",
] as const;

export const familyMemberRoleSchema = z.enum(CLIENT_FAMILY_MEMBER_ROLES);

export const CLIENT_RELATIONSHIP_TYPES = [
  "assistant",
  "travel_companion",
  "colleague",
  "referrer",
  "other",
] as const;

export const clientRelationshipTypeSchema = z.enum(CLIENT_RELATIONSHIP_TYPES);

/** Add a structured preference. */
export const createClientPreferenceSchema = z.object({
  category: clientPreferenceCategorySchema.default("other"),
  label: z
    .string()
    .trim()
    .min(1, { message: "Enter what they prefer or avoid." })
    .max(200, { message: "Preference is too long." }),
  sentiment: clientPreferenceSentimentSchema.default("prefer"),
  notes: optionalText(2000, "Notes are too long").nullable().optional(),
});

export type CreateClientPreferenceInput = z.infer<
  typeof createClientPreferenceSchema
>;
export type CreateClientPreferenceBody = z.input<
  typeof createClientPreferenceSchema
>;

/** Update, confirm, or soft-deactivate a preference. */
export const updateClientPreferenceSchema = z
  .object({
    category: clientPreferenceCategorySchema.optional(),
    label: z
      .string()
      .trim()
      .min(1, { message: "Enter what they prefer or avoid." })
      .max(200, { message: "Preference is too long." })
      .optional(),
    sentiment: clientPreferenceSentimentSchema.optional(),
    notes: optionalText(2000, "Notes are too long").nullable().optional(),
    is_confirmed: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type UpdateClientPreferenceInput = z.infer<
  typeof updateClientPreferenceSchema
>;
export type UpdateClientPreferenceBody = z.input<
  typeof updateClientPreferenceSchema
>;

/** Create a new household or join / extend an existing one. */
export const upsertClientFamilySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("create"),
    name: z
      .string()
      .trim()
      .min(1, { message: "Enter a household name." })
      .max(120, { message: "Household name is too long." }),
    role: familyMemberRoleSchema.optional().default("primary"),
  }),
  z.object({
    mode: z.literal("join"),
    family_id: z.string().uuid({ message: "Pick a valid household." }),
    role: familyMemberRoleSchema.optional().default("member"),
  }),
  z.object({
    mode: z.literal("add_member"),
    client_id: z.string().uuid({ message: "Pick a valid client." }),
    role: familyMemberRoleSchema.optional().default("member"),
  }),
]);

export type UpsertClientFamilyInput = z.infer<typeof upsertClientFamilySchema>;
export type UpsertClientFamilyBody = z.input<typeof upsertClientFamilySchema>;

/** Update household name, membership role, or primary flag. */
export const updateClientFamilySchema = z
  .object({
    family_name: z
      .string()
      .trim()
      .min(1, { message: "Enter a household name." })
      .max(120, { message: "Household name is too long." })
      .optional(),
    member_client_id: z.string().uuid().optional(),
    role: familyMemberRoleSchema.optional(),
    is_primary: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type UpdateClientFamilyInput = z.infer<typeof updateClientFamilySchema>;
export type UpdateClientFamilyBody = z.input<typeof updateClientFamilySchema>;

/** Remove another member from the household (body for DELETE /family). */
export const removeClientFamilyMemberSchema = z.object({
  member_client_id: z.string().uuid({ message: "Pick a valid client." }),
});

export type RemoveClientFamilyMemberInput = z.infer<
  typeof removeClientFamilyMemberSchema
>;
export type RemoveClientFamilyMemberBody = z.input<
  typeof removeClientFamilyMemberSchema
>;

/** Link a non-household related person. */
export const createClientRelationshipSchema = z.object({
  to_client_id: z.string().uuid({ message: "Pick a valid client." }),
  relationship_type: clientRelationshipTypeSchema,
  notes: optionalText(2000, "Notes are too long").nullable().optional(),
});

export type CreateClientRelationshipInput = z.infer<
  typeof createClientRelationshipSchema
>;
export type CreateClientRelationshipBody = z.input<
  typeof createClientRelationshipSchema
>;

export const preferenceIdSchema = z
  .string()
  .uuid({ message: "That preference link looks invalid." });

export const relationshipIdSchema = z
  .string()
  .uuid({ message: "That relationship link looks invalid." });

export const familyIdSchema = z
  .string()
  .uuid({ message: "That household link looks invalid." });

export const documentIdSchema = z
  .string()
  .uuid({ message: "That document link looks invalid." });

export const CLIENT_DOCUMENT_TYPES = [
  "passport",
  "visa",
  "insurance",
  "other",
] as const;

export const clientDocumentTypeSchema = z.enum(CLIENT_DOCUMENT_TYPES, {
  errorMap: () => ({ message: "Choose a document type" }),
});

export const CLIENT_DOCUMENT_STATUSES = [
  "pending_upload",
  "pending_review",
  "verified",
  "rejected",
  "expired",
] as const;

export const clientDocumentStatusSchema = z.enum(CLIENT_DOCUMENT_STATUSES);

export const CLIENT_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const CLIENT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

const optionalIsoDate = z
  .union([
    z.literal("").transform(() => null),
    z.null(),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Use YYYY-MM-DD for dates" }),
  ])
  .optional();

/** Register a travel document upload (file goes to signed URL after). */
export const createClientDocumentSchema = z.object({
  document_type: clientDocumentTypeSchema,
  document_number: optionalText(80, "Document number is too long")
    .nullable()
    .optional(),
  issuing_country: optionalCountryCode,
  expiry_date: optionalIsoDate,
  date_of_birth: optionalIsoDate,
  file_name: z
    .string()
    .trim()
    .min(1, { message: "Choose a file to upload." })
    .max(200, { message: "File name is too long." }),
  mime_type: z
    .string()
    .trim()
    .refine(
      (value): value is (typeof CLIENT_DOCUMENT_MIME_TYPES)[number] =>
        (CLIENT_DOCUMENT_MIME_TYPES as readonly string[]).includes(value),
      { message: "Use a PDF or image (JPEG, PNG, or WebP)." },
    ),
  file_size_bytes: z
    .number()
    .int()
    .positive({ message: "Choose a file to upload." })
    .max(CLIENT_DOCUMENT_MAX_BYTES, {
      message: "File is too large. Keep it under 10 MB.",
    }),
});

export type CreateClientDocumentInput = z.infer<
  typeof createClientDocumentSchema
>;
export type CreateClientDocumentBody = z.input<
  typeof createClientDocumentSchema
>;

/** Update metadata or verification status. */
export const updateClientDocumentSchema = z
  .object({
    document_type: clientDocumentTypeSchema.optional(),
    document_number: optionalText(80, "Document number is too long")
      .nullable()
      .optional(),
    issuing_country: optionalCountryCode,
    expiry_date: optionalIsoDate,
    date_of_birth: optionalIsoDate,
    status: z
      .enum(["pending_review", "verified", "rejected", "expired"])
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update.",
  });

export type UpdateClientDocumentInput = z.infer<
  typeof updateClientDocumentSchema
>;
export type UpdateClientDocumentBody = z.input<
  typeof updateClientDocumentSchema
>;

export const searchFamiliesQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, { message: "Enter a household name to search." })
    .max(120),
});

export type SearchFamiliesQuery = z.infer<typeof searchFamiliesQuerySchema>;
