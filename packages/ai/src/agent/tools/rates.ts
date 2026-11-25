import { z } from "zod";

import type { RateCompareCard } from "../../tools";
import type { TripFacts } from "../../types";

import { defineAgentTool } from "./define-tool";
import { resolveRateSearchInput } from "./rate-search-gate";
import { uniqueLabels } from "./unique-labels";

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
    "Read the last rate search on this trip: the rooms found with cost, inclusions, cancellation (including cancel-by date when present), payment/guarantee cards, commissionable flag, limited availability, nightly breakdown, rate type/product code, taxes/fees, room extras, hotel/room amenities, and property check-in/check-out times from that shop.",
    "Amenities: room amenities = in-room features — list under Amenities with names only (never say included/chargeable). Rate inclusions = Included: names only. Hotel amenities with ComplimentaryInd false = may be chargeable; other hotel amenities are on-property names only. Fees/tax are already in stay cost; room extras are priced add-ons. Property times come from GDS policies when present.",
    "CANCEL RULES: If notes say \"Free cancel until {date}\" or cancel by YYYY-MM-DD, answer with that date — never say you lack a cut-off. If notes say post-deadline fee was not returned by GDS, say free until that date and that the charge after cut-off must be confirmed with the hotel — do not invent a night charge.",
    "Use for follow-up questions about rooms, prices, what is included, cancellation dates, guarantee cards, commissionable vs not, amenities, check-in/check-out times, fees/charges, extras (crib/rollaway), nightly price split, offers or which room suits the client. Prefer this over hotel_get for facts from the live GDS rate just shown.",
    "When the client already chose a room (trip facts show selected / status booking) and the advisor wants today's live price: prefer rates_price_check (not this tool).",
    "Do not use for hotels never searched (use rates_search or hotel_get).",
    "Returns status found while the shop is still open (about 2 hours, same window as quote send). Returns status expired with a message when the last shop closed (aged out or stay/party changed): relay that soft prompt and offer to rates_search again — do not invent cancel/payment/price from memory. Returns status none when there was no recent search: tell the advisor to search rates first. Cost is the advisor's net, never the sell. Call these the current rates when you speak to the advisor. Never suggest a hotel minimum markup.",
  ].join(" "),
  schema: z.object({}).strict(),
  risk: "read",
  progress: () => "Reviewing current rates…",
  run: (_input, handlers) => handlers.getRateSnapshot(),
});

export const ratesPriceCheckTool = defineAgentTool({
  name: "rates_price_check",
  description: [
    "Recheck today's hotel cost for a room on this trip — use anytime after options quote / PDF, or after the client chose a room.",
    "Live GDS (Public / Special): calls the live price check and compares cost on file vs today.",
    "Contracted: returns skipped — tell the advisor no live recheck is needed; cost stays as on file.",
    "Pasted quote: returns skipped — advise confirming with the supplier if the quote is old.",
    "Pass hotel + room when the advisor names them; omit both to recheck every currently selected client room.",
    "Do NOT use rates_search for a pure today's-price ask on an already-chosen room — this tool is the source of truth.",
    "Reply in short prose from the note field. If status is changed, tell them to tap Use today's cost (or update cost). If requires_reshop / rate gone: tell them to search rates again for that hotel. Never invent prices. Never mention supplier brand names.",
  ].join(" "),
  schema: z
    .object({
      hotel: z
        .string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .describe("Hotel name when the advisor named one."),
      room: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .optional()
        .describe("Room name when the advisor named one."),
      line_item_id: z
        .string()
        .uuid()
        .optional()
        .describe("Exact options-quote room id when known from trip facts."),
    })
    .strict(),
  risk: "read",
  progress: (input) =>
    input.hotel ? `Checking today's price at ${input.hotel}…` : "Checking today's hotel price…",
  run: (input, handlers) =>
    handlers.priceCheckRate({
      hotel: input.hotel,
      room: input.room,
      lineItemId: input.line_item_id,
    }),
});

export const ratesSearchTool = defineAgentTool({
  name: "rates_search",
  description: [
    "Search rates for one or more hotels in a destination for given dates and party. A saved stay hotel is NOT required — never ask the advisor to save a stay or confirm before searching.",
    "HARD GATE: only call when check-in, check-out, rooms, and adult count are known from the trip facts or this message. Prefer the stay that matches destination (multi-city: Maldives hotels → Maldives stay dates, not the full trip window); else pass check_in/check_out from that stay or the advisor message; party from travellers. If any of those are missing, do NOT call this tool and do NOT invent dates, party, or rooms — ask once in plain text. Child count may be 0.",
    "ROOMS: required before every rates_search when stay.rooms is unset — ask once and suggest (e.g. family of four: \"1 or 2 for Tokyo? Families often need 2 for live rates\"), then trip_set_stays with rooms and pass rooms here (Studio saves rooms on the stay for the summary sidebar). Never invent or default a room count. Prefer stay.rooms from trip facts when set. Rooms are optional at trip create.",
    "MULTI-ROOM SPLITS: when rooms > 1 and the party divides evenly, call this tool — Studio applies a matching split. When it does not (e.g. 3A+1C in 2 rooms), ask who sleeps in each room, then pass room_occupancies (matching or mixed both OK) — Studio prices mixed layouts as separate rooms and combines totals. Never invent a split. Each room ≥1 adult.",
    "Use when the advisor names hotels for prices, asks for rates / cheapest / compare costs, or says \"need rates\" / \"suggest and get rates\". Pass hotels in one call (max 5); they run in parallel. Never ask \"Search rates?\".",
    "Do not use after hotel_find when the advisor only asked to suggest or find hotels — wait until they ask for rates in plain text.",
    "When suggest-and-rates in one message: only rates_search the top 1–2 shoppable picks — contracted (contracted true) or open_gds with sabre_hotel_code (pass hotel_codes). For Preferred/guide-only (atlas, contracted false, no sabre_hotel_code): do not rates_search — say Preferred with no rate file yet and offer paste quote.",
    "When the client already chose a room and the advisor only wants today's price: use rates_price_check instead of this tool. Do not re-open a shopping rates table for a pure price recheck.",
    "When the advisor also wants the hotel on the trip itinerary, call trip_set_stays in the same turn, then this. Pricing alone does not need trip_set_stays.",
    "Do not use for place questions (place_get_notes) or to list hotels without prices (hotel_find).",
    "Returns one entry per hotel: ok | no_rates | not_in_pureluxe | several_matches | offline | timeout, with alternatives when not ok. Cost is advisor-only. Never echo status codes, supplier brands, mapping, hotel codes, GDS, Rate Layer, or Atlas in the reply.",
    "When status is no_rates or not_in_pureluxe: speak like a senior travel advisor on a call — e.g. \"I don't have rates for Four Seasons / Capitol on those dates.\" Offer two clear next steps: paste a supplier quote, or try another hotel you can price (name 1–2 from alternatives / shortlist). If the search was 1 room with 4+ guests (or children) and no_rates: say the party may not fit one room — offer 2 rooms (then confirm who sleeps in each room) or a larger room / paste quote, not only another hotel. Honour the tool note when it mentions one-room occupancy. Never say mapped, unmapped, GDS code, live GDS, or ops. Never invent prices or seasons.",
    "Do not use when the advisor only changes markup or sell — that is quote_add_options / quote_set_client_price (no new search, no rate table). Never say you refreshed rates for a markup change.",
    "After this tool (shopping only): Studio shows the room-rate table under the reply — it already has room, offer/promo line, meal, cost, cancel (often \"Free until {date}\"), payment, and hotel notes. If show_compare_card is false (same dates/party and hotels already covered): do not say \"see the table below\" or that you refreshed rates; reply in 1–2 short lines. The table shows cost only — no sell or Set markup in the UI. When the table is shown (show_compare_card true): HARD RULE — chat is only 1–2 short talkable lines (which room/offer to prefer + next step: markup % or sell). End by inviting them to ask for any room or the full cancel / payment detail if they need more than the table. Do NOT restate hotel, dates, party, nights, prices, cost/night, stay cost, meal plans, cancellation, payment, deposit, inclusions, hotel stars/amenities, or \"Search: …\" — the table has them. Never open with process talk (\"I asked…\", \"the search ran…\"). Later cancel-date / payment-card / commission questions: call rates_get_snapshot — if a cancel-by date is in the notes or table, state it; never claim it is missing when \"until\" or cancel_deadline is present. If post-deadline fee was not returned by GDS, say so and advise confirming with the hotel. If returned nights/dates do not match the stay you meant (e.g. full trip vs one city stay): one \"> **Heads-up:** …\" then stop short — do not mark up or treat as the correct stay quote. Else Heads-up only for cancel/market risk or location mismatch. Package rates → package sheet + extra-night; sell after markup is package + extras for the stay. Nightly costs live in the table only. Never paste a markdown table of rooms or prices. Advisors add rooms via chat with quote_add_options — never tell them to tap Add or any rate-row control (founder #19). Prefer rates_get_snapshot for follow-ups that do not need a fresh search.",
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
      rooms: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe(
          "Rooms from advisor or stay.rooms. Required when unset on trip facts — never invent or default. After the advisor answers, pass this and trip_set_stays with the same value.",
        ),
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
      room_occupancies: z
        .array(
          z
            .object({
              adults: z.number().int().min(1).max(20),
              children: z.number().int().min(0).max(20).optional(),
              child_ages: z
                .array(z.number().int().min(0).max(17))
                .max(20)
                .optional(),
            })
            .strict(),
        )
        .min(2)
        .max(10)
        .optional()
        .describe(
          "One entry per room after the advisor confirms who sleeps where. Required when rooms > 1 and the party does not divide evenly (or when ages per room are stated). Matching or mixed adult/child counts are OK — Studio dual-shops mixed layouts. child_ages may differ per room. Do not invent.",
        ),
      hotel_codes: z
        .record(z.string().trim().min(1).max(120), z.string().trim().min(1).max(32))
        .optional()
        .describe(
          "Sabre hotel codes keyed by hotel name from hotel_find open_gds rows (sabre_hotel_code). Required to price Open picks; omit for contracted PureLuxe hotels.",
        ),
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
    const altNames = uniqueLabels(
      compare.hotels.flatMap((hotel) =>
        hotel.status === "ok" ? [] : hotel.alternatives.slice(0, 3),
      ),
    );
    for (const alt of altNames) {
      buttons.push({
        label: `Rates · ${alt}`,
        action: "rates_search",
        args: ratesArgs([alt]),
      });
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
        room_occupancies: input.room_occupancies?.map((row) => ({
          adults: row.adults,
          children: row.children,
          childAges: row.child_ages,
        })),
      },
      trip ?? null,
    );
    if ("error" in resolved) {
      return { error: resolved.error, missing: resolved.missing };
    }
    const hotelCodes =
      input.hotel_codes && Object.keys(input.hotel_codes).length > 0
        ? Object.fromEntries(
            Object.entries(input.hotel_codes)
              .map(([name, code]) => [name.trim(), code.trim()] as const)
              .filter(([name, code]) => name.length > 0 && code.length > 0),
          )
        : undefined;
    const roomOccupancies =
      input.room_occupancies?.map((row) => ({
        adults: row.adults,
        children: row.children,
        childAges: row.child_ages,
      })) ?? resolved.roomOccupancies;

    return handlers.searchRates({
      destination: input.destination,
      hotels: input.hotels,
      checkIn: resolved.checkIn,
      checkOut: resolved.checkOut,
      rooms: resolved.rooms,
      adults: resolved.adults,
      children: resolved.children,
      infants: resolved.infants,
      childAges: input.child_ages,
      roomOccupancies,
      hotelCodes:
        hotelCodes && Object.keys(hotelCodes).length > 0 ? hotelCodes : undefined,
    });
  },
});
