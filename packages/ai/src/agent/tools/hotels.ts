import { z } from "zod";

import type { AgentChoice } from "../../tools";
import type { TripFacts } from "../../types";

import { defineDeskTool } from "./define-tool";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const priceTier = z.enum(["ultra_luxury", "luxury", "premium"]);
const MAX_HOTEL_CHOICES = 6;

type FoundHotelHit = { name?: string; destination?: string | null };

function hotelFindPayload(result: unknown): {
  hotels: FoundHotelHit[];
  did_you_mean: string[];
} {
  if (!result || typeof result !== "object") return { hotels: [], did_you_mean: [] };
  const row = result as { hotels?: unknown; did_you_mean?: unknown };
  const hotels = Array.isArray(row.hotels) ? (row.hotels as FoundHotelHit[]) : [];
  const didYouMean = Array.isArray(row.did_you_mean)
    ? row.did_you_mean.filter((name): name is string => typeof name === "string" && name.trim().length > 0)
    : [];
  return { hotels, did_you_mean: didYouMean };
}

function partyFromTrip(trip: TripFacts): { adults: number; children: number; rooms: number } {
  const travellers = trip.travellers ?? [];
  const children = travellers.filter((person) => person.party_role === "child").length;
  const namedAdults = travellers.filter((person) => person.party_role !== "child").length;
  const adults = Math.max(1, namedAdults || 2);
  return { adults, children, rooms: Math.max(1, Math.ceil(adults / 2)) };
}

function tripDestination(trip: TripFacts, hotelDestination?: string | null): string | null {
  const fromHotel = hotelDestination?.trim();
  if (fromHotel) return fromHotel;
  const fromStay = trip.stay?.city?.trim();
  if (fromStay) return fromStay;
  const fromList = trip.stays?.find((stay) => stay.city.trim())?.city.trim();
  return fromList || null;
}

/** Rates · hotel (or Did you mean) when the trip already has dates. */
function hotelFindChoices(result: unknown, trip: TripFacts | null): AgentChoice[] {
  if (!trip?.starts_on || !trip.ends_on) return [];
  const { hotels, did_you_mean: didYouMean } = hotelFindPayload(result);
  const party = partyFromTrip(trip);
  const names =
    didYouMean.length > 0
      ? didYouMean
      : hotels
          .map((hotel) => hotel.name?.trim())
          .filter((name): name is string => Boolean(name));
  if (names.length === 0) return [];

  const destination =
    tripDestination(trip, hotels[0]?.destination) ?? tripDestination(trip, null);
  if (!destination) return [];

  const ratesArgs = (hotelNames: string[]) => ({
    destination,
    hotels: hotelNames.slice(0, 5),
    check_in: trip.starts_on,
    check_out: trip.ends_on,
    rooms: party.rooms,
    adults: party.adults,
    children: party.children,
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
    "Load the details held for a hotel by name, including a hotel that is not on this trip: check-in and check-out times, stay rules, cancellation, payment, transfers, benefits, required charges, extras, offers, blackout dates and minimum markup.",
    "Use for hotel rules, offers or charges, or to compare hotels (one call per hotel, in the same turn). Pass the stay dates when known so only the contracts and offers for those dates come back.",
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
    "Find PureLuxe hotels by name (fuzzy), destination, price tier (ultra_luxury / luxury / premium), similar to another hotel, or a similar price band.",
    "Use when the advisor names a hotel, asks for suggestions, wants others in the same tier, or says \"similar to X\". A saved stay is not required.",
    "For \"similar\" / \"same tier\" / \"same price range\", pass similar_to or tier so results stay in that band — do not list cheaper out-of-tier hotels from general knowledge.",
    "Do not use for hotel rules or charges (hotel_get), place notes (place_get_notes), or room prices (rates tools).",
    "Returns PureLuxe hotels only, with tier and style tags. When the name is unclear, did_you_mean lists close matches instead of guessing.",
    "When the trip has dates, a Rates button appears for each hotel (and Did you mean when unsure).",
    "When the advisor also wants prices in the same message, call rates_search next in the same turn with the hotels found — do not wait for a Rates tap.",
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
      limit: z.number().int().min(1).max(10).optional().describe("How many hotels to return (default 5)."),
    })
    .strict(),
  risk: "read",
  progress: (input) =>
    input.similar_to || input.destination || input.tier
      ? "Finding hotels…"
      : "Looking up the hotel…",
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
    return handlers.findHotels({
      name: input.name,
      destination: input.destination,
      tier: input.tier,
      similarTo: input.similar_to,
      priceBandLike: input.price_band_like,
      limit: input.limit,
    });
  },
});
