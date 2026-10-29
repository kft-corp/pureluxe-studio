import type { TripBuilderStage, TripFacts } from "../types";

function listedStays(trip: TripFacts) {
  return trip.stays ?? [];
}

function stayComplete(trip: TripFacts): boolean {
  const stays = listedStays(trip);
  if (stays.length === 0) {
    return Boolean(
      trip.stay?.check_in && trip.stay.check_out && trip.stay.property_name,
    );
  }
  return stays.every(
    (stay) => stay.check_in && stay.check_out && stay.property_name,
  );
}

function ratesComplete(trip: TripFacts): boolean {
  const stays = listedStays(trip);
  if (stays.length === 0) return Boolean(trip.rates.selected);
  return stayComplete(trip) && stays.every((stay) => stay.rate_selected);
}

const ACCEPTED = new Set(["booking", "confirmed", "completed"]);
const WITH_CLIENT = new Set(["quote_sent", "waiting_on_client"]);

/** Options quote has at least one room with a client price (matches Studio Stage 3d). */
function quoteOptionsPriced(trip: TripFacts): boolean {
  if (trip.rates.candidates.some((rate) => rate.sell_amount != null)) return true;
  return ratesComplete(trip) && trip.quote.sell_total != null;
}

function quoteOptionsNeedPrice(trip: TripFacts): boolean {
  return (
    trip.rates.candidates.length > 0 &&
    !trip.rates.candidates.some((rate) => rate.sell_amount != null)
  );
}

/**
 * Stage from trip facts. Studio sends the stage its header shows; this is the fallback.
 */
export function resolveTripStage(trip: TripFacts): TripBuilderStage {
  if (trip.stage) return trip.stage;
  if (!trip.client) return "client";
  if (ACCEPTED.has(trip.status)) return "booking";
  if (WITH_CLIENT.has(trip.status)) return "quote";
  if (trip.travellers_confirmed === false) return "client";
  if (!trip.starts_on || !trip.ends_on) return "stay";
  if (trip.legs_confirmed === false) return "stay";
  // Stage 3c: rates shopping does not require a hotel saved on the stay.
  if (!quoteOptionsPriced(trip)) return "rates";
  return "quote";
}

/** Short next-step hint for prompts. Studio sends the header's line; this is the fallback. */
export function resolveNextStep(trip: TripFacts): string {
  if (trip.next_step) return trip.next_step;
  if (!trip.client) return "Select a client";
  if (trip.travellers_confirmed === false) return "Name the travellers";
  if (!trip.starts_on || !trip.ends_on) return "Set the trip dates";
  if (trip.legs_confirmed === false) return "Add places or search rates";
  if (quoteOptionsPriced(trip)) return "Send the options quote";
  if (quoteOptionsNeedPrice(trip)) return "Set sell prices on the quote";
  if (!stayComplete(trip)) return "Suggest hotels and search rates";
  return "Add rooms to the options quote";
}

/** Explicit gaps the model should treat as unknown / incomplete. */
export function listTripGaps(trip: TripFacts): string[] {
  const gaps: string[] = [];
  const accepted = ACCEPTED.has(trip.status);

  if (!trip.client) gaps.push("Client not assigned");
  if (trip.client && trip.travellers_confirmed === false) {
    gaps.push("Travellers not confirmed");
  }
  if (!trip.starts_on || !trip.ends_on) gaps.push("Trip dates not set");
  if (trip.starts_on && trip.ends_on && trip.legs_confirmed === false) {
    gaps.push("Stay list not finished");
  }

  const stays = listedStays(trip);
  if (stays.length === 0 && !trip.stay) {
    gaps.push("Stay not set (hotel, city, dates)");
  } else if (stays.length === 0 && trip.stay) {
    if (!trip.stay.property_name) gaps.push("Hotel name missing");
    if (!trip.stay.city.trim()) gaps.push("City missing");
    if (!trip.stay.check_in || !trip.stay.check_out) {
      gaps.push("Check-in/out dates incomplete");
    }
  } else {
    stays.forEach((stay, index) => {
      const label = stay.city.trim() || `Stay ${index + 1}`;
      if (!stay.property_name) gaps.push(`${label}: hotel missing`);
      if (!stay.check_in || !stay.check_out) gaps.push(`${label}: dates incomplete`);
      if (accepted && stay.property_name && !stay.rate_selected) {
        gaps.push(`${label}: client's room not chosen`);
      }
    });
  }

  if (accepted && stays.length === 0 && !trip.rates.selected) {
    gaps.push("Client's room not chosen");
  }

  const building = !ACCEPTED.has(trip.status) && !WITH_CLIENT.has(trip.status);
  if (building && trip.legs_confirmed !== false && !quoteOptionsPriced(trip)) {
    if (quoteOptionsNeedPrice(trip)) {
      gaps.push("Rooms on the quote need a sell");
    } else {
      gaps.push(
        "No rate compare yet — name hotels or ask for suggestions, then search rates (saved stay not required)",
      );
    }
  }

  if (trip.rates.selected && trip.quote.sell_total == null) {
    gaps.push("Client sell price not set");
  }

  return gaps;
}
