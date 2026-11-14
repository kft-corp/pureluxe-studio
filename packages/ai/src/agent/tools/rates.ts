import { z } from "zod";

import type { RateCompareCard } from "../../tools";
import type { TripFacts } from "../../types";

import { defineAgentTool } from "./define-tool";
import { resolveRateSearchInput } from "./rate-search-gate";

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

/** First pull or a real change — Studio streams the rate card. Same search again: skip. */
function shouldShowCompareCard(result: unknown): boolean {
  if (!result || typeof result !== "object") return true;
  return (result as { show_compare_card?: unknown }).show_compare_card !== false;
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
    "Search rates for one or more hotels in a destination for given dates and party. A saved stay hotel is NOT required — never ask the advisor to save a stay or confirm before searching.",
    "HARD GATE: only call when check-in, check-out, rooms, and adult count are known from the trip facts or this message. Prefer the stay that matches destination (multi-city: Maldives hotels → Maldives stay dates, not the full trip window); else pass check_in/check_out from that stay or the advisor message; party from travellers. If any of those are missing, do NOT call this tool and do NOT invent dates or party — ask once in plain text. Child count may be 0.",
    "Use when the advisor names hotels for prices, asks for rates / cheapest / compare costs, or says \"need rates\" / \"suggest and get rates\". Pass hotels in one call (max 5); they run in parallel. Never ask \"Search rates?\".",
    "Do not use after hotel_find when the advisor only asked to suggest or find hotels — wait until they ask for rates in plain text.",
    "When suggest-and-rates in one message: only rates_search the top 1–2 contracted (contracted true) hotel_find picks. For Preferred/guide-only (contracted false): do not rates_search — say Preferred with no rate file yet and offer paste quote.",
    "When the client already chose a room (selected in trip facts / booking stage) and the advisor only wants today's price for that choice: search only the chosen hotel(s), then reply in short prose comparing the chosen room's quoted sell to today's cost. Do not suggest other rooms or treat it as a new quote. Never mention hotel minimum markup or commission rate.",
    "When the advisor also wants the hotel on the trip itinerary, call trip_set_stays in the same turn, then this. Pricing alone does not need trip_set_stays.",
    "Do not use for place questions (place_get_notes) or to list hotels without prices (hotel_find).",
    "Returns one entry per hotel: ok | no_rates | not_in_pureluxe | several_matches | offline | timeout, with alternatives when not ok. Cost is advisor-only. Never echo status codes or brand names in the reply — say \"I can't offer that hotel\" / \"no rates for those dates\" in plain language.",
    "When status is no_rates or the hotel is Preferred-only: say so, offer rates_use_pasted_quote or another Contracted hotel — never invent prices or seasons.",
    "Do not use when the advisor only changes markup or sell — that is quote_add_options / quote_set_client_price (no new search, no rate table). Never say you refreshed rates for a markup change.",
    "After this tool (shopping only): Studio shows the room-rate table only on the first pull or when dates, party/travellers, rooms, or new hotels were searched. If show_compare_card is false (same dates/party and hotels already covered): do not say \"see the table below\" or that you refreshed rates; reply in 1–2 short lines. The table shows cost only — no sell or Set markup in the UI. When the table is shown: reply in 1–2 short talkable lines (which room to prefer + next step: add with a markup or sell). Do not restate hotel, dates, party, preference, prices, meal plans, search summary lines, or the full inclusions list — the cards already have them. Never open with process talk (\"I asked…\", \"the search ran…\"). If returned nights/dates do not match the stay you meant (e.g. full trip vs one city stay): one \"> **Heads-up:** …\" then stop short — do not mark up or treat as the correct stay quote. Else Heads-up only for cancel/market risk. Package rates → package sheet + extra-night; sell after markup is package + extras for the stay. Nightly → cost per night / stay cost. Never paste a markdown table of rooms or prices. Advisors add rooms via chat with quote_add_options — never tell them to tap Add or any rate-row control (founder #19). Prefer rates_get_snapshot for follow-ups that do not need a fresh search.",
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
      check_in: isoDate
        .optional()
        .describe("YYYY-MM-DD from trip facts or the advisor message — never invent."),
      check_out: isoDate
        .optional()
        .describe("YYYY-MM-DD from trip facts or the advisor message — never invent."),
      rooms: z.number().int().min(1).max(10).optional().describe("Rooms; default one per two adults when known."),
      adults: z
        .number()
        .int()
        .min(1)
        .max(20)
        .optional()
        .describe("Adult count from trip travellers or the advisor message — never invent."),
      children: z.number().int().min(0).max(20).optional().describe("Child/infant count; 0 when none."),
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
  rateCompare: (result, trip) =>
    clientChoseRoom(trip) || !shouldShowCompareCard(result) ? null : asCompare(result),
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
  run: async (input, handlers, _call, trip) => {
    const resolved = resolveRateSearchInput(
      {
        check_in: input.check_in ?? "",
        check_out: input.check_out ?? "",
        rooms: input.rooms,
        adults: input.adults ?? 0,
        children: input.children,
        destination: input.destination,
      },
      trip ?? null,
    );
    if ("error" in resolved) {
      return { error: resolved.error, missing: resolved.missing };
    }
    return handlers.searchRates({
      destination: input.destination,
      hotels: input.hotels,
      checkIn: resolved.checkIn,
      checkOut: resolved.checkOut,
      rooms: resolved.rooms,
      adults: resolved.adults,
      children: resolved.children,
      childAges: input.child_ages,
    });
  },
});
