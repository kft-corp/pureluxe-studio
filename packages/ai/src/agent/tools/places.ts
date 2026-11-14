import { z } from "zod";

import { defineDeskTool } from "./define-tool";

export const placeGetNotesTool = defineDeskTool({
  name: "place_get_notes",
  description: [
    "Read Atlas destination notes for a country, city or hotel: visa, seasons, vibe, length of stay, first-trip where-to-go, suggested itinerary shapes, experience bank (things to do / restaurants), and hotels listed there.",
    "Use for place / visa / season / vibe / when to visit / where to visit / first-trip / suggested itineraries / things to do / restaurants / vegetarian dining / classic route / \"tell me about [hotel]\" — not for shopping shortlists or rates. For hotel shopping shortlists use hotel_find (experiences may be returned for Pick/Nearby — use Nearby section only when the ask needs food/activities; otherwise cite at most one cue in Pick). For things to do / restaurants alone, prefer this tool's experience bank over forcing a hotel shortlist.",
    "When+where / where to visit / suggest places: Atlas returns a SHORT first-trip spine by default (not every city). Reply like a senior colleague on a call — talkable, not a catalog paste; never meta openers (\"here again\", \"shortened\", \"from the notes\"). Personalise from trip party in the tool brief / query: family with children → family framing, never lead with honeymoon; no party → general spine. Reply shape (markdown only): (1) one short talkable intro (name the party when known), (2) ### When to go only if present in the tool, (3) ### Where to go only if present, with real '-' bullets as `- **City (nights):** …` weaving who it suits into the sentence (do not stamp \"Best for:\" on every row) plus labelled Getting around / Classic [destination] / Ideal length lines when present — never unbulleted city prose blocks, (4) optional one \"> **Heads-up:** …\" when trip nights don't fit the classic/preferred length (never \"today is [date]\"), (5) at most one preference question (e.g. \"Tokyo only, or Tokyo and Hakone?\") — never \"Should I set…?\" / shall-I-set-stays; do not write stays on a places-only ask until they choose; no hotel/rates question on that turn. Keep every city, season, logistics, night range, and who-it-suits fact from the tool — never invent; restate stiff tool prose in talkable advisor English but never flatten bullets into a short prose paragraph. If 7-night classic and 10–14 night length both appear, clarify once (7 = tight classic; 10–14 = preferred luxury pace).",
    "Best-time / weather / climate / when-only: keep ### When to go. When the tool includes **Season by season:** keep those bullets (climate / best for / watch out) — never invent months or temperatures. Where-only: keep ### Where to go — do not invent a When list. Money / etiquette / getting there-around / ideal length / neighbourhood / Best for / suggested itinerary shapes / Seasonal variants / experience bank: keep the tool's labelled lines (Suits / Lead time / Veg/Jain) — never invent shapes, nights, experiences, or restaurants not in the tool.",
    "Follow-up \"more places\" / full / expand / weather detail: call place_get_notes again with that ask in query (and destination / earlier set) so Atlas returns the longer city list and/or season table.",
    "Suggest / find / which hotels to offer the client: use hotel_find instead (Rate Layer + Atlas preferred). Do not use this tool as a substitute for hotel_find when the advisor wants suggestions.",
    "Parse the advisor's intent before calling: destination is the travel country/city the question is about (e.g. Japan), never where they apply for a visa.",
    "If they ask where to apply / VFS / embassy and name a second country (e.g. apply in India), put that in apply_in and keep destination as the trip country.",
    "Pass the advisor's full question in query. When trip travellers or dates are known, include that party and date span in query (e.g. family of 4 / 2 adults 2 children, 13–16 Jan) so Atlas personalises — never invent party. For follow-ups that omit the place (\"what is the visa?\" / \"more places\"), set earlier to the recent place or trip context.",
    "Notes are short by default. If they ask for full, detailed, more places, or all documents, the tool returns the longer brief.",
    "Do not use for hotel contract rules, offers or charges (use hotel_get) or room prices (use rates_search / rates_get_snapshot).",
    "matched false or empty notes means Atlas has nothing for that name: still answer with short general guidance so the advisor gets something useful. Soft topics (weather, best time, what it is like): \"Generally, …\". Visa / documents answers: restate in clear senior-advisor English while locking every fee, processing time, document item, place name, and visa type from Atlas — never invent; keep Fee / Processing / Where to apply / documents / tips / alternate route; one short confirm-with-embassy/VFS line (not long source essays); at most one Heads-up and do not repeat the same heads-up on a follow-up; on a visa- or documents-only ask do not close with hotel-in-mind / suggest. Visa / entry with no Atlas data: only high-level \"Typically, …\" plus confirm with embassy / VFS / official source — never invent exact fees, document lists, processing times, prices or availability.",
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
