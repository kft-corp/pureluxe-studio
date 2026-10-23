import { z } from "zod";

import { defineDeskTool } from "./define-tool";

export const placeGetNotesTool = defineDeskTool({
  name: "place_get_notes",
  description: [
    "Read destination information for a country, city or hotel: visa, seasons, what it is like, getting there, rooms, dining, wellness and which hotels can be offered there.",
    "Use for any place or hotel-content question, including a place that is not on this trip and a bare name such as a country or a resort.",
    "Do not use for hotel contract rules, offers or charges (use hotel_get) or room prices (use rates_get_snapshot).",
    "Returns the matched information and the hotels that can be offered there. matched false means there is no information for that name: say you don't have it yet, and never describe the place from general knowledge.",
  ].join(" "),
  schema: z
    .object({
      query: z
        .string()
        .trim()
        .min(2)
        .max(300)
        .describe("The place or hotel name, with the advisor's question, e.g. the visa question as asked."),
      city_hint: z
        .string()
        .trim()
        .max(120)
        .optional()
        .describe("A city or country from the trip when the question doesn't name one."),
    })
    .strict(),
  risk: "read",
  progress: () => "Gathering destination information…",
  run: (input, handlers) =>
    handlers.getPlaceNotes({ query: input.query, cityHint: input.city_hint }),
});
