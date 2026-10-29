import { linkStayShellProperty } from "@pureluxe/db";
import { searchRatesForLeg, type SearchRatesResult } from "@pureluxe/rates";
import type { SearchRatesBody } from "@pureluxe/shared";

import { loadHotelStayFacts } from "../stays/hotel-contract-facts";
import { requireEditableTrip } from "../access/require-assigned-trip";
import { loadTripStay } from "../trip/trip-detail";

import { matchPropertyByName } from "@/lib/rates/match-property";
import { buildRateSearchNotes } from "@/lib/rates/rate-search-pack";
import { saveTripRateSearch } from "@/lib/rates/rate-search-store";

import { loadPartyPricingContext } from "./party-pricing-context";

/** Facts already stored for this hotel and these dates. Shown with the rate cards. */
export type RateStayNotes = {
  checkIn: string | null;
  checkOut: string | null;
  payment: string[];
  offers: string[];
  required: string[];
  markup: string | null;
};

export type TripRateSearchResult = SearchRatesResult & {
  /** Plain-language hotel rules already on file for these dates. */
  hotel_brief: string | null;
  /** Short lines for the rate cards. Null when this hotel has none on file. */
  stay_notes: RateStayNotes | null;
  /**
   * Filtered rooms plus the hotel facts for these dates.
   * Follow-up questions read the same text. Bank payout is not included.
   */
  rate_context: string | null;
};

/** Thin wrapper — Studio API → @pureluxe/rates brain. */
export async function searchTripRates(
  input: SearchRatesBody,
  actor: { memberId: string },
): Promise<TripRateSearchResult> {
  if (input.trip_id) {
    await requireEditableTrip(input.trip_id, actor.memberId);
  }

  let propertyId = input.property_id;
  if (!propertyId && input.trip_id) {
    const stay = await loadTripStay(input.trip_id);
    const hotel = stay?.property_name?.trim();
    if (hotel) {
      const match = await matchPropertyByName(hotel);
      if (match.status === "linked" && match.property) {
        propertyId = match.property.id;
        if (stay?.leg_id) {
          await linkStayShellProperty({
            trip_id: input.trip_id,
            leg_id: stay.leg_id,
            property_id: match.property.id,
            property_name: match.property.name,
          });
        }
      } else if (match.status === "several") {
        return unmatchedHotelResult(
          `I found more than one hotel for "${hotel}": ${match.names.join(", ")}. Send Hotel: with the exact name, tap Update stay, then search again.`,
        );
      } else {
        return unmatchedHotelResult(
          `No hotel named "${hotel}" is available. Send Hotel: with the name stored on the property, tap Update stay, or paste a supplier quote.`,
        );
      }
    }
  }

  let childAges = input.child_ages ?? [];
  let clientMarketCodes = input.client_market_codes ?? [];
  if (input.trip_id && (childAges.length === 0 || clientMarketCodes.length === 0)) {
    const party = await loadPartyPricingContext({
      tripId: input.trip_id,
      checkIn: input.check_in,
    });
    if (childAges.length === 0) childAges = party.child_ages;
    if (clientMarketCodes.length === 0) {
      clientMarketCodes = party.client_market_codes;
    }
  }

  const result = await searchRatesForLeg({
    trip_id: input.trip_id ?? undefined,
    leg_id: input.leg_id ?? undefined,
    destination_text: input.destination_text,
    property_id: propertyId,
    check_in: input.check_in,
    check_out: input.check_out,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    child_ages: childAges,
    client_market_codes: clientMarketCodes,
    currency: input.currency,
    channel: "studio",
    requested_by_id: actor.memberId,
    paste_text: input.paste_text,
  });

  let hotelBrief: string | null = null;
  let stayNotes: RateStayNotes | null = null;
  let payment: string | null = null;
  if (propertyId) {
    const facts = await loadHotelStayFacts({
      propertyId,
      checkIn: input.check_in,
      checkOut: input.check_out,
      contractId: null,
    });
    hotelBrief = facts?.chatBrief ?? null;
    stayNotes = facts ? stayNotesFromFacts(facts) : null;
    payment = facts?.paymentLines.map((line) => line.trim()).filter(Boolean).join(" ") || null;
  }
  const options = result.options.map((option) => ({
    ...option,
    payment_summary: option.payment_summary ?? payment,
  }));
  const rateContext = buildRateSearchNotes(options, hotelBrief, null);
  await saveTripRateSearch({
    search: input,
    propertyId: propertyId ?? null,
    memberId: actor.memberId,
    result,
    options,
    hotelBrief,
    markup: null,
  });

  if (propertyId && result.status === "stub") {
    return {
      ...result,
      options,
      status: "empty",
      hotel_brief: hotelBrief,
      stay_notes: stayNotes,
      rate_context: rateContext,
      message:
        "No rate covers these dates. Change the dates or paste a supplier quote.",
    };
  }

  return {
    ...result,
    options,
    hotel_brief: hotelBrief,
    stay_notes: stayNotes,
    rate_context: rateContext,
  };
}

function stayNotesFromFacts(facts: {
  checkInTime: string | null;
  checkOutTime: string | null;
  paymentLines: string[];
  offers: string[];
  requiredCharges: string[];
  markup: string | null;
}): RateStayNotes | null {
  const notes: RateStayNotes = {
    checkIn: facts.checkInTime,
    checkOut: facts.checkOutTime,
    payment: facts.paymentLines.slice(0, 3),
    offers: facts.offers.slice(0, 4),
    required: facts.requiredCharges.slice(0, 3),
    // MVP (#29): never pass hotel commission / min markup into stay notes.
    markup: null,
  };
  const hasAny =
    notes.checkIn ||
    notes.checkOut ||
    notes.payment.length > 0 ||
    notes.offers.length > 0 ||
    notes.required.length > 0;
  return hasAny ? notes : null;
}

function unmatchedHotelResult(message: string): TripRateSearchResult {
  return {
    status: "empty",
    options: [],
    routing: {
      layer: null,
      pattern: null,
      destination_type: null,
      destination_profile_id: null,
      sources_tried: [],
    },
    message,
    hotel_brief: null,
    stay_notes: null,
    rate_context: null,
    adapters: [],
  };
}
