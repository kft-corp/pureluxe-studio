import type Anthropic from "@anthropic-ai/sdk";
import {
  BOOKING_STATUSES,
  BOOKING_WORK_FILTERS,
  JOURNEY_STAGE_FILTERS,
} from "@pureluxe/shared";

export const SEARCH_TRIPS_TOOL: Anthropic.Tool = {
  name: "search_trips",
  description: [
    "List Studio trips other than the one open in chat: a client's past, current, and upcoming trips, or the advisor's own pipeline.",
    "Use for “where did she go last time?”, “does he have another trip open?”, “do these dates clash?”, “what's the status of the Chen trip?”,",
    "“which of my trips are waiting on the client?”, or “which trips start next week and are not confirmed?”.",
    "Each row has status, dates, cities, traveller count, client price, margin, and whether the quote PDF is out of date.",
    "Hotels are not on a trip row. For hotels, room, confirmation, or cancellation, call search_bookings.",
    "Read-only.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {
      client_id: {
        type: "string",
        description:
          "Studio client UUID from search_clients or trip facts. Matches trips where they are the lead or a traveller.",
      },
      query: {
        type: "string",
        description: "Trip title, lead client name, or stay city.",
      },
      stage: {
        type: "string",
        enum: [...JOURNEY_STAGE_FILTERS],
        description:
          "working = still planning. building / quote_sent / waiting_on_client / booking = that status. upcoming / on_trip / past = by travel dates. cancelled = cancelled only. any (default) = everything except cancelled.",
      },
      mine: {
        type: "boolean",
        description:
          "true = only trips the advisor owns. Default false when client_id is set (whole team), true otherwise.",
      },
      limit: {
        type: "number",
        description: "Max rows (1–20). Defaults to 10.",
      },
    },
    required: [],
  },
};

export const SEARCH_BOOKINGS_TOOL: Anthropic.Tool = {
  name: "search_bookings",
  description: [
    "List Studio bookings (hotels, flights, transfers, activities).",
    "Use for “which hotel did she stay at?”, “has she stayed at Atlantis before?”, “show her upcoming bookings”,",
    "“is the Dubai booking confirmed?”, “what's the confirmation number?”, “was anything cancelled?”,",
    "or the advisor's queue: bookings still pending, free cancellation ending soon, departing soon, arriving today, or in house.",
    "Rows have hotel, city, dates, status, confirmation ref, and free-cancel deadline. Prices, room, board, travellers, and the cancel policy are in get_booking.",
    "Read-only.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {
      client_id: {
        type: "string",
        description: "Studio client UUID. Matches bookings where they are the lead client.",
      },
      query: {
        type: "string",
        description: "Hotel name, booking title, city, confirmation ref, or client name.",
      },
      work: {
        type: "string",
        enum: [...BOOKING_WORK_FILTERS],
        description:
          "needs_confirm = pending or on hold. cancel_soon = free cancellation ends within 14 days. depart_soon = starts within 7 days. arriving = starts today. in_house = guest is there now.",
      },
      status: {
        type: "string",
        enum: [...BOOKING_STATUSES],
        description: "Exact booking status. Omit to see every status except superseded.",
      },
      mine: {
        type: "boolean",
        description:
          "true = only bookings the advisor owns. Default false when client_id is set (whole team), true otherwise.",
      },
      limit: {
        type: "number",
        description: "Max rows (1–20). Defaults to 10.",
      },
    },
    required: [],
  },
};

export const GET_BOOKING_TOOL: Anthropic.Tool = {
  name: "get_booking",
  description: [
    "Load one booking in full: dates, room type, board, rooms and guests, supplier, confirmation ref,",
    "team cost, client price, margin, expected commission, cancellation policy and deadline, travellers with passport expiry, and status history fields.",
    "free_cancellation is already worked out: open = can still cancel free, passed = the policy penalty applies, unknown = no deadline on file.",
    "Use for price and margin on a past stay, “what if we cancel today?”, “what did we pay?”, or before an amend.",
    "Call with a booking_id from search_bookings. Read-only.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {
      booking_id: {
        type: "string",
        description: "Booking UUID from search_bookings.",
      },
    },
    required: ["booking_id"],
  },
};

/** Trip and booking history tools. Available with or without an open trip. */
export const HISTORY_TOOLS: Anthropic.Tool[] = [
  SEARCH_TRIPS_TOOL,
  SEARCH_BOOKINGS_TOOL,
  GET_BOOKING_TOOL,
];
