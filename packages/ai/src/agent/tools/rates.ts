import { z } from "zod";

import type { RateCompareCard } from "../../tools";
import type { TripFacts } from "../../types";

import { defineAgentTool } from "./define-tool";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

function asCompare(result: unknown): RateCompareCard | null {
  if (!result || typeof result !== "object") return null;
  const compare = (result as { compare?: unknown }).compare;
  if (!compare || typeof compare !== "object") return null;
  const hotels = (compare as RateCompareCard).hotels;
  return Array.isArray(hotels) ? (compare as RateCompareCard) : null;
}

/** Client already picked a room — do not show the shopping rate table. */
function clientChoseRoom(trip: TripFacts | null): boolean {
  if (!trip) return false;
  if (trip.rates.selected) return true;
  return trip.rates.candidates.some((rate) => rate.selected);
}

export const ratesGetSnapshotTool = defineAgentTool({
  name: "rates_get_snapshot",
  description: [
    "Read the last rate search on this trip: the rooms found with cost, inclusions, cancellation and payment, plus the hotel rules for those dates.",
    "Use for follow-up questions about rooms, prices, what is included, cancellation, offers or which room suits the client.",
    "When the client already chose a room (trip facts show selected / status booking): prefer this or the trip facts for a price check — answer only for the chosen room(s); do not re-shop other rooms.",
    "Do not use for hotels never searched (use rates_search or hotel_get).",
    "Returns status none when there is no recent search: tell the advisor to search rates first. Cost is the advisor's net, never the sell. Call these the current rates when you speak to the advisor. Never suggest a hotel minimum markup.",
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
    "Use when the advisor names hotels for prices, asks for rates / cheapest / compare costs, or says \"need rates\" / \"suggest and get rates\". Pass hotels in one call (max 5); they run in parallel. Run immediately; never ask \"Search rates?\".",
    "Do not use after hotel_find when the advisor only asked to suggest or find hotels — wait until they ask for rates or tap Rates.",
    "When suggest-and-rates in one message: search the top 1–2 hotel_find picks unless they named more hotels or said all / every.",
    "When the client already chose a room (selected in trip facts / booking stage) and the advisor only wants today's price for that choice: search only the chosen hotel(s), then reply in short prose comparing the chosen room's quoted sell to today's cost. Do not suggest other rooms or treat it as a new quote. Never mention hotel minimum markup or commission rate.",
    "When the advisor also wants the hotel on the trip itinerary, call trip_set_stays in the same turn, then this. Pricing alone does not need trip_set_stays.",
    "Do not use for place questions (place_get_notes) or to list hotels without prices (hotel_find).",
    "Returns one entry per hotel: ok | no_rates | not_in_pureluxe | several_matches | offline | timeout, with alternatives when not ok. Cost is advisor-only. Never echo status codes or brand names in the reply — say \"I can't offer that hotel\" / \"no rates for those dates\" in plain language.",
    "When status is no_rates: say so, suggest other stay dates or another hotel from hotel_find, or rates_use_pasted_quote — never invent prices or seasons.",
    "After this tool (shopping only): Studio shows the room-rate table under the reply (Set markup / cost). Reply in 1–2 short lines (which room to prefer + next step). Do not restate hotel, dates, party, preference, prices, meal plans, or the full inclusions list — header/sidebar and the table already have them. Heads-up only for cancel/market risk. Package rates → package sheet + extra-night; sell after markup is package + extras for the stay. Nightly → per night / stay total. Never paste a markdown table of rooms or prices. Advisors add rooms via chat with quote_add_options, not row buttons.",
    "When comparing hotels on fit (which hotel is better), use the fixed hotel-compare markdown table (Entry room, Pool upgrade, Water / overwater, Meal plans, Transfers & taxes, Free cancel until, Applied markup; optional Location / Family). That compare table is separate from the room-rate UI table. Pass child_ages when the advisor stated ages.",
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
      child_ages: z
        .array(z.number().int().min(0).max(17))
        .max(20)
        .optional()
        .describe("Stated child ages when known; preferred over passport DOBs."),
    })
    .strict(),
  risk: "read",
  progress: (input) =>
    input.hotels.length > 1 ? "Searching rates for several hotels…" : "Searching rates…",
  rateCompare: (result, trip) => (clientChoseRoom(trip) ? null : asCompare(result)),
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
      childAges: input.child_ages,
    }),
});
