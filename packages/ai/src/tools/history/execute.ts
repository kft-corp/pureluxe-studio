import {
  BOOKING_STATUSES,
  BOOKING_WORK_FILTERS,
  JOURNEY_STAGE_FILTERS,
} from "@pureluxe/shared";
import { z } from "zod";

import type { HistoryToolHandlers } from "./types";

const searchTripsInputSchema = z.object({
  client_id: z.string().uuid().optional(),
  query: z.string().trim().max(100).optional(),
  stage: z.enum(JOURNEY_STAGE_FILTERS).optional(),
  mine: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const searchBookingsInputSchema = z.object({
  client_id: z.string().uuid().optional(),
  query: z.string().trim().max(200).optional(),
  work: z.enum(BOOKING_WORK_FILTERS).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  mine: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const getBookingInputSchema = z.object({
  booking_id: z.string().uuid(),
});

export type HistoryToolName = "search_trips" | "search_bookings" | "get_booking";

/**
 * Run a history tool.
 * Throws ZodError / AppError-shaped errors for the root executor to wrap.
 */
export async function executeHistoryTool(
  name: HistoryToolName,
  input: unknown,
  handlers: HistoryToolHandlers,
): Promise<unknown> {
  switch (name) {
    case "search_trips": {
      const parsed = searchTripsInputSchema.parse(input ?? {});
      return handlers.searchTrips({
        clientId: parsed.client_id,
        query: parsed.query,
        stage: parsed.stage,
        mine: parsed.mine,
        limit: parsed.limit,
      });
    }
    case "search_bookings": {
      const parsed = searchBookingsInputSchema.parse(input ?? {});
      return handlers.searchBookings({
        clientId: parsed.client_id,
        query: parsed.query,
        work: parsed.work,
        status: parsed.status,
        mine: parsed.mine,
        limit: parsed.limit,
      });
    }
    case "get_booking": {
      const parsed = getBookingInputSchema.parse(input ?? {});
      return handlers.getBooking({ bookingId: parsed.booking_id });
    }
  }
}
