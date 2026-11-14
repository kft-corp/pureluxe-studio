import { z } from "zod";

import type { AgentChoice } from "../../tools";
import type { TripFacts } from "../../types";

import { defineDeskTool } from "./define-tool";
import { datesFromTrip, partyFromTrip } from "./rate-search-gate";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const priceTier = z.enum(["Tier 1", "Tier 2", "Tier 3"]);
const MAX_HOTEL_CHOICES = 6;

type FoundHotelHit = {
  name?: string;
  destination?: string | null;
  contracted?: boolean;
  source?: string;
};

function hotelFindPayload(result: unknown): {
  hotels: FoundHotelHit[];
  did_you_mean: string[];
  coverage_check: boolean;
} {
  if (!result || typeof result !== "object") {
    return { hotels: [], did_you_mean: [], coverage_check: false };
  }
  const row = result as {
    hotels?: unknown;
    did_you_mean?: unknown;
    coverage_check?: unknown;
  };
  const hotels = Array.isArray(row.hotels) ? (row.hotels as FoundHotelHit[]) : [];
  const didYouMean = Array.isArray(row.did_you_mean)
    ? row.did_you_mean.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];
  return {
    hotels,
    did_you_mean: didYouMean,
    coverage_check: row.coverage_check === true,
  };
}

function tripDestination(trip: TripFacts | null, hotelDestination?: string | null): string | null {
  if (!trip) return hotelDestination?.trim() || null;
  const fromHotel = hotelDestination?.trim();
  if (fromHotel) return fromHotel;
  const fromStay = trip.stay?.city?.trim();
  if (fromStay) return fromStay;
  const fromList = trip.stays?.find((stay) => stay.city.trim())?.city.trim();
  return fromList || null;
}

/** Rates · hotel (or Did you mean) when trip has dates + party. Skip coverage / Preferred-only. */
function hotelFindChoices(result: unknown, trip: TripFacts | null): AgentChoice[] {
  const tripParty = partyFromTrip(trip);
  if (!tripParty) return [];
  const { hotels, did_you_mean: didYouMean, coverage_check } = hotelFindPayload(result);
  if (coverage_check) return [];
  const rooms = Math.max(1, Math.ceil(tripParty.adults / 2));
  // Rates chips only for shoppable hotels (Rate Layer or Atlas with property_id).
  const names =
    didYouMean.length > 0
      ? didYouMean
      : hotels
          .filter((hotel) => hotel.contracted === true)
          .map((hotel) => hotel.name?.trim())
          .filter((name): name is string => Boolean(name));
  if (names.length === 0) return [];

  const destination =
    tripDestination(trip, hotels[0]?.destination) ?? tripDestination(trip, null);
  if (!destination) return [];

  const tripDates = datesFromTrip(trip, destination);
  if (!tripDates) return [];

  const ratesArgs = (hotelNames: string[]) => ({
    destination,
    hotels: hotelNames.slice(0, 5),
    check_in: tripDates.checkIn,
    check_out: tripDates.checkOut,
    rooms,
    adults: tripParty.adults,
    children: tripParty.children,
  });

  const buttons: AgentChoice[] = [];
  if (didYouMean.length === 0 && names.length > 1) {
    buttons.push({
      label: `Rates · all ${Math.min(names.length, 5)}`,
      action: "rates_search",
      args: ratesArgs(names),
    });
  }
  for (const name of names.slice(0, MAX_HOTEL_CHOICES)) {
    buttons.push({
      label: didYouMean.length > 0 ? `Did you mean · ${name}` : `Rates · ${name}`,
      action: "rates_search",
      args: ratesArgs([name]),
    });
  }
  return buttons.slice(0, MAX_HOTEL_CHOICES);
}

export const hotelGetTool = defineDeskTool({
  name: "hotel_get",
  description: [
    "Load the details held for a hotel by name, including a hotel that is not on this trip: check-in and check-out times, stay rules, cancellation, payment, transfers, market limits, benefits, required charges, extras, offers and blackout dates. Do not mention hotel minimum markup or commission floors to the advisor.",
    "Use for hotel rules, offers, charges or market/passport restrictions, or to compare hotels (one call per hotel, in the same turn). Pass the stay dates when known so only the contracts and offers for those dates come back.",
    "When Market is set on the contract, surface it as a short heads-up in the reply.",
    "Do not use to list or suggest hotels (use hotel_find), for prices of rooms (use rates_get_snapshot) or for what a place is like (use place_get_notes).",
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

export const hotelFindTool = defineDeskTool({
  name: "hotel_find",
  description: [
    "Find hotels by name (fuzzy), destination, proposed tier (Tier 1 / Tier 2 / Tier 3), similar to another hotel, or a similar price band.",
    "Results: Rate Layer (shoppable, contracted true) first; Atlas preferred/guide hotels fill when Rate Layer is thin or empty (source atlas, contracted false unless linked).",
    "Use when the advisor names a hotel, asks for suggestions, wants others in the same tier, or says \"similar to X\". A saved stay is not required.",
    "Coverage check (founder #16): after dates/stays are set, before asking hotel-in-mind / suggest — pass destination + coverage_check true (limit 1). Silent in the UI. If hotels empty: say none loaded and ask for names or a paste quote — never offer to suggest. If any hotel returned (Rate Layer or Atlas): do NOT list hotel names; only ask in plain text whether they have a hotel in mind or want suggestions. List hotels only when they explicitly ask to suggest/find hotels (coverage_check false).",
    "For \"similar\" / \"same tier\" / \"same price range\", pass similar_to or tier so results stay in that band — do not list cheaper out-of-tier hotels from general knowledge.",
    "Do not use for hotel rules or charges (hotel_get), place notes (place_get_notes), or room prices (rates tools).",
    "Returns hotels ranked behind the scenes with guide_rating (show in chat as Rating only — never \"Guide\") plus guide_score_factors fit — weighted by trip party, advisor ask, and client pref hints when Studio passes them. Also returns tier, style tags, contracted, source, badge (rates logic only — never stamp Contracted/Preferred in chat), area, partner, why, choose_if, and experiences. When the name is unclear, did_you_mean lists close matches instead of guessing.",
    "Suggest / find hotels alone: call this tool only (no coverage_check) — do not call rates_search. Default limit 3. Reply shape (see trip/home prompt): talkable intro; each hotel as `1. **Name** — Rating X.X` then 1–2 spoken sentences weaving area/why/choose_if — not a nested Area/Why/Best-for form; optional Programme line from partner when useful. Experiences: on a plain suggest-hotels ask do NOT list ### Nearby for the stay; in **Pick** cite at most one grounded nearby cue from experiences when it helps choose the hotel. Add ### Nearby (max 2–3) only when the ask mentions food / restaurants / things to do / activities / kids experiences or prefs clearly need it. **Pick** also uses area plus up to 1–2 plain-language strengths — never rating alone. Banned in chat: Guide, Partner, Choose if, score/scores, matrix, tool, Rate Layer, Atlas. Never dump factor keys or say \"family score\" / \"access score\" — translate to talkable English. Why A vs B / why rating high (only when asked): short 3–5 plain-strength compare from guide_score_factors only. Never invent names or ratings. Never say tap Rates (founder #19). Empty result: ask for names or paste quote. Never say \"no hotels\" when this tool returned names.",
    "Only when the same message also asks for prices, rates, cheapest, or \"suggest and get rates\" AND check-in, check-out, rooms, and adults are known: call rates_search next for the top 1–2 Contracted picks (or the hotels they named). Do not rates_search Preferred (contracted false) — offer paste quote instead. If dates/party missing, ask once; do not invent.",
  ].join(" "),
  schema: z
    .object({
      name: z.string().trim().min(2).max(120).optional().describe("Hotel name or part of it."),
      destination: z
        .string()
        .trim()
        .min(2)
        .max(80)
        .optional()
        .describe("Country, city or destination to search in."),
      tier: priceTier.optional().describe("Hotels-sheet tier to filter or suggest."),
      similar_to: z
        .string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .describe("Find hotels like this one (same destination, tier and style)."),
      price_band_like: z
        .string()
        .trim()
        .min(2)
        .max(120)
        .optional()
        .describe("Find hotels in a similar nightly price band to this one."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("How many hotels to return (default 3 for shortlists)."),
      coverage_check: z
        .boolean()
        .optional()
        .describe(
          "True = silent coverage probe only (founder #16). Do not list hotels in the reply; no Rates choices; no Finding hotels progress.",
        ),
    })
    .strict(),
  risk: "read",
  progress: (input) => {
    if (input.coverage_check) return "";
    return input.similar_to || input.destination || input.tier
      ? "Finding hotels…"
      : "Looking up the hotel…";
  },
  choices: hotelFindChoices,
  run: async (input, handlers) => {
    if (
      !input.name &&
      !input.destination &&
      !input.tier &&
      !input.similar_to &&
      !input.price_band_like
    ) {
      return { error: "Pass a hotel name, destination, tier, similar_to or price_band_like." };
    }
    const coverage = input.coverage_check === true;
    const askBits = [
      input.destination,
      input.name,
      input.similar_to,
      input.price_band_like,
    ]
      .filter(Boolean)
      .join(" ");
    const result = await handlers.findHotels({
      name: input.name,
      destination: input.destination,
      tier: input.tier,
      similarTo: input.similar_to,
      priceBandLike: input.price_band_like,
      limit: coverage ? 1 : input.limit,
      includeExperiences: !coverage,
      ask: askBits || undefined,
    });
    if (coverage && result && typeof result === "object") {
      return { ...result, coverage_check: true };
    }
    return result;
  },
});
