import { z } from "zod";

import type { StayRequest } from "../types";

/** Inputs shared by the trip chat's changes and the home chat's trip_create. */

/** YYYY-MM-DD, or MM-DD when the advisor gave no year (the year is worked out). */
export const looseDate = z
  .string()
  .regex(/^(?:\d{4}-)?\d{2}-\d{2}$/, "Use YYYY-MM-DD, or MM-DD when no year was given.")
  .describe("MM-DD when the advisor didn't say the year (never add one yourself), else YYYY-MM-DD.");

export const clientId = z.string().uuid().describe("Client id from client_search, client_get or the trip facts.");

export const leadChoice = z
  .enum(["named", "household_primary"])
  .default("named")
  .describe("household_primary when the advisor named a family or household (\"the Mehta family\", \"all 4\") rather than one person: its primary member leads.");

export const stayInput = z
  .object({
    city: z.string().trim().min(1).max(200).describe("City, island or destination name only, without labels such as \"City:\"."),
    check_in: looseDate.optional(),
    check_out: looseDate.optional(),
    hotel: z.string().trim().min(2).max(200).nullable().optional().describe("Hotel name. Omit to keep the current one."),
    rooms: z.number().int().min(1).max(20).optional(),
  })
  .strict();

export function toStayRequest(stay: z.infer<typeof stayInput>): StayRequest {
  return {
    city: stay.city,
    checkIn: stay.check_in,
    checkOut: stay.check_out,
    hotel: stay.hotel,
    rooms: stay.rooms,
  };
}
