import { z } from "zod";

import type { RateCompareCard } from "../../tools";

import { defineAgentTool } from "./define-tool";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

function asCompare(result: unknown): RateCompareCard | null {
  if (!result || typeof result !== "object") return null;
  const compare = (result as { compare?: unknown }).compare;
  if (!compare || typeof compare !== "object") return null;
  const hotels = (compare as RateCompareCard).hotels;
  return Array.isArray(hotels) ? (compare as RateCompareCard) : null;
}

export const ratesGetSnapshotTool = defineAgentTool({
  name: "rates_get_snapshot",
  description: [
    "Read the last rate search on this trip: the rooms found with team cost, inclusions, cancellation and payment, plus the hotel rules for those dates.",
    "Use for follow-up questions about rooms, prices, what is included, cancellation, offers or which room suits the client.",
    "Do not use for rooms already saved on the trip (they are in the trip facts) or for hotels never searched (use rates_search or hotel_get).",
    "Returns status none when there is no recent search: tell the advisor to search rates first. Team cost is the advisor's cost, never the client price. Call these the current rates when you speak to the advisor.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "read",
  progress: () => "Reviewing current rates…",
  run: (_input, handlers) => handlers.getRateSnapshot(),
});

export const ratesSearchTool = defineAgentTool({
  name: "rates_search",
  description: [
    "Search rates for one or more hotels in a destination for given dates and party. A saved stay is NOT required — never ask the advisor to save a stay or confirm before searching.",
    "Use when the advisor names hotels, asks for prices, wants to compare, or says \"need rates\". Pass every hotel in one call (max 5); they run in parallel. Run immediately; never ask \"Search rates?\".",
    "When the advisor also wants the hotel on the trip itinerary, call trip_set_stays in the same turn, then this. Pricing alone does not need trip_set_stays.",
    "Do not use for place questions (place_get_notes) or to list hotels without prices (hotel_find).",
    "Returns one entry per hotel: ok | no_rates | not_in_pureluxe | several_matches | offline | timeout, with alternatives when not ok. Team cost is advisor-only.",
    "After this tool: Studio shows one room-rate table under the reply. Reply with short prose only (dates, party, commission rate, inclusions/cancel heads-up, which room to suggest). Never paste a markdown table of rooms or prices — that duplicates the UI. Advisors add rooms via chat with quote_add_options, not row buttons.",
    "When comparing hotels on fit (which hotel is better), use the fixed hotel-compare markdown table (Entry room, Pool upgrade, Water / overwater, Meal plans, Transfers & taxes, Free cancel until, Commission rate — never Minimum markup; optional Location / Family). That compare table is separate from the room-rate UI table.",
  ].join(" "),
  schema: z
    .object({
      destination: z.string().trim().min(2).max(80),
      hotels: z
        .array(z.string().trim().min(2).max(120))
        .min(1)
        .max(5)
        .describe("Hotel names to search, in the order the advisor named them."),
      check_in: isoDate,
      check_out: isoDate,
      rooms: z.number().int().min(1).max(10).default(1),
      adults: z.number().int().min(1).max(20),
      children: z.number().int().min(0).max(20).default(0),
    })
    .strict(),
  risk: "read",
  progress: (input) =>
    input.hotels.length > 1 ? "Searching rates for several hotels…" : "Searching rates…",
  rateCompare: (result) => asCompare(result),
  choices: (result) => {
    const compare = asCompare(result);
    if (!compare) return [];
    const buttons: Array<{ label: string; action: string; args: Record<string, unknown> }> = [];
    const ratesArgs = (hotels: string[]) => ({
      destination: compare.destination,
      hotels,
      check_in: compare.check_in,
      check_out: compare.check_out,
      rooms: compare.rooms,
      adults: compare.adults,
      children: compare.children,
    });
    // Missed hotels only — room Adds are via chat (quote_add_options), not chips on the rate table.
    for (const hotel of compare.hotels) {
      if (hotel.status === "ok") continue;
      for (const alt of hotel.alternatives.slice(0, 3)) {
        buttons.push({
          label: `Rates · ${alt}`,
          action: "rates_search",
          args: ratesArgs([alt]),
        });
      }
    }
    return buttons.slice(0, 8);
  },
  run: (input, handlers) =>
    handlers.searchRates({
      destination: input.destination,
      hotels: input.hotels,
      checkIn: input.check_in,
      checkOut: input.check_out,
      rooms: input.rooms,
      adults: input.adults,
      children: input.children,
    }),
});
