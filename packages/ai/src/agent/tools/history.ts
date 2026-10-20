import {
  BOOKING_STATUSES,
  BOOKING_WORK_FILTERS,
  JOURNEY_STAGE_FILTERS,
} from "@pureluxe/shared";
import { z } from "zod";

import { defineAgentTool } from "./define-tool";

const clientId = z
  .string()
  .uuid()
  .optional()
  .describe("Client id from client_search or the trip facts.");

const mine = z
  .boolean()
  .optional()
  .describe("true = only the advisor's own. Default: whole team when client_id is set, otherwise mine.");

const limit = z.number().int().min(1).max(20).optional().describe("Max rows, 1–20. Default 10.");

export const historySearchTripsTool = defineAgentTool({
  name: "history_search_trips",
  description: [
    "List Studio trips other than the open one: a client's past, current and upcoming trips, or the advisor's own pipeline.",
    "Use for where a client went last time, another open trip, date clashes, the status of a named trip, or which trips are waiting or starting soon.",
    "Do not use for hotels, rooms or confirmation numbers (trip rows have no hotels; use history_search_bookings).",
    "Returns rows with status, dates, cities, traveller count, client price, margin and whether the quote is out of date.",
  ].join(" "),
  schema: z
    .object({
      client_id: clientId,
      query: z.string().trim().max(100).optional().describe("Trip title, lead client name or stay city."),
      stage: z
        .enum(JOURNEY_STAGE_FILTERS)
        .optional()
        .describe("working = still planning; upcoming / on_trip / past = by travel dates; any (default) = all but cancelled."),
      mine,
      limit,
    })
    .strict(),
  risk: "read",
  progress: () => "Searching trips…",
  run: (input, handlers) =>
    handlers.searchTrips({
      clientId: input.client_id,
      query: input.query,
      stage: input.stage,
      mine: input.mine,
      limit: input.limit,
    }),
});

export const historySearchBookingsTool = defineAgentTool({
  name: "history_search_bookings",
  description: [
    "List Studio bookings (hotels, flights, transfers, activities).",
    "Use for hotels a client stayed at, upcoming bookings, confirmation status or numbers, cancellations, or the advisor's queue (pending, free cancellation ending, departing, arriving, in house).",
    "Do not use for prices, room, travellers or the cancel policy of one booking (use history_get_booking).",
    "Returns rows with hotel, city, dates, status, confirmation ref and free-cancel deadline.",
  ].join(" "),
  schema: z
    .object({
      client_id: clientId,
      query: z
        .string()
        .trim()
        .max(200)
        .optional()
        .describe("Hotel name, booking title, city, confirmation ref or client name."),
      work: z
        .enum(BOOKING_WORK_FILTERS)
        .optional()
        .describe("needs_confirm, cancel_soon (14 days), depart_soon (7 days), arriving (today) or in_house."),
      status: z.enum(BOOKING_STATUSES).optional().describe("Exact status. Omit for all but superseded."),
      mine,
      limit,
    })
    .strict(),
  risk: "read",
  progress: () => "Searching bookings…",
  run: (input, handlers) =>
    handlers.searchBookings({
      clientId: input.client_id,
      query: input.query,
      work: input.work,
      status: input.status,
      mine: input.mine,
      limit: input.limit,
    }),
});

export const historyGetBookingTool = defineAgentTool({
  name: "history_get_booking",
  description: [
    "Load one booking in full: dates, room, board, guests, supplier, confirmation ref, team cost, client price, margin, commission, cancellation policy and deadline, and travellers.",
    "Use for the price or margin of a past stay, what cancelling today would cost, or before an amend.",
    "Do not use without a booking_id (find it with history_search_bookings).",
    "free_cancellation is worked out: open = free until the deadline, passed = the policy penalty applies, unknown = no deadline on file.",
  ].join(" "),
  schema: z
    .object({
      booking_id: z.string().uuid().describe("Booking id from history_search_bookings."),
    })
    .strict(),
  risk: "read",
  progress: () => "Loading the booking…",
  run: (input, handlers) => handlers.getBooking({ bookingId: input.booking_id }),
});
