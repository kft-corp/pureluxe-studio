import { z } from "zod";

import { defineDeskTool } from "./define-tool";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const hotelGetTool = defineDeskTool({
  name: "hotel_get",
  description: [
    "Load the details held for a hotel by name, including a hotel that is not on this trip: check-in and check-out times, stay rules, cancellation, payment, transfers, benefits, required charges, extras, offers, blackout dates and minimum markup.",
    "Use for hotel rules, offers or charges, or to compare hotels (one call per hotel, in the same turn). Pass the stay dates when known so only the contracts and offers for those dates come back.",
    "Do not use for prices of rooms (use rates_get_snapshot) or for what a place is like (use place_get_notes).",
    "Returns matching hotels with facts. An empty list means no hotel with that name; facts null means nothing is on file.",
  ].join(" "),
  schema: z
    .object({
      name: z.string().trim().min(2).max(120).describe("Hotel name or part of it."),
      check_in: isoDate.optional().describe("Stay check-in, YYYY-MM-DD."),
      check_out: isoDate.optional().describe("Stay check-out, YYYY-MM-DD. Needs check_in."),
    })
    .strict(),
  risk: "read",
  progress: () => "Reviewing hotel details…",
  run: async (input, handlers) => {
    if (input.check_out && !(input.check_in && input.check_in < input.check_out)) {
      return { error: "check_out needs a check_in before it." };
    }
    return handlers.getHotel({
      name: input.name,
      checkIn: input.check_out ? input.check_in : undefined,
      checkOut: input.check_out,
    });
  },
});
