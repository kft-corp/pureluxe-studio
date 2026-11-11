import { z } from "zod";

import { defineDeskTool } from "./define-tool";

export const placeGetNotesTool = defineDeskTool({
  name: "place_get_notes",
  description: [
    "Read Atlas destination notes for a country, city or hotel: visa, seasons, vibe, length of stay, and hotels listed there.",
    "Use for any place or hotel-content question, including a place that is not on this trip and a bare name such as a country or a resort.",
    "Parse the advisor's intent before calling: destination is the travel country/city the question is about (e.g. Japan), never where they apply for a visa.",
    "If they ask where to apply / VFS / embassy and name a second country (e.g. apply in India), put that in apply_in and keep destination as the trip country.",
    "Pass the advisor's full question in query. For follow-ups that omit the place (\"what is the visa?\"), set earlier to the recent place or trip context.",
    "Notes are short by default. If they ask for full, detailed, or all documents, the tool returns the longer brief.",
    "Do not use for hotel contract rules, offers or charges (use hotel_get) or room prices (use rates_get_snapshot).",
    "matched false or empty notes means Atlas has nothing for that name: still answer with short general guidance so the advisor gets something useful. Soft topics (weather, best time, what it is like): \"Generally, …\". Visa / entry with no Atlas data: only high-level \"Typically, …\" plus confirm with embassy / VFS / official source — never invent exact fees, document lists, processing times, prices or availability.",
  ].join(" "),
  schema: z
    .object({
      query: z
        .string()
        .trim()
        .min(2)
        .max(300)
        .describe("The place or hotel name, with the advisor's question, e.g. the visa question as asked."),
      destination: z
        .string()
        .trim()
        .max(120)
        .optional()
        .describe(
          "Travel destination country or city this question is about (e.g. Japan). Never the country where they lodge a visa application.",
        ),
      apply_in: z
        .string()
        .trim()
        .max(120)
        .optional()
        .describe(
          "Where they apply for the visa when asked (e.g. India for VFS). Not the travel destination.",
        ),
      earlier: z
        .string()
        .trim()
        .max(400)
        .optional()
        .describe(
          "Recent place or trip context when the current question does not name the destination (e.g. prior Japan / Kyoto).",
        ),
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
    handlers.getPlaceNotes({
      query: input.query,
      destination: input.destination,
      applyIn: input.apply_in,
      earlier: input.earlier,
      cityHint: input.city_hint,
    }),
});
