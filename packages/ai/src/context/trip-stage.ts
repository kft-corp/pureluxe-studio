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

/** Derive Phase 1 stage from trip facts (same rules as Studio UI). */
export function resolveTripStage(trip: TripFacts): TripBuilderStage {
  if (!trip.client) return "client";
  if (trip.travellers_confirmed === false) return "client";
  if (!trip.starts_on || !trip.ends_on) return "stay";
  if (trip.legs_confirmed === false) return "stay";
  if (!stayComplete(trip)) return "stay";
  if (!ratesComplete(trip)) return "rates";
  return "package";
}

/** Short next-step hint for prompts / UI. */
export function resolveNextStep(trip: TripFacts): string {
  if (!trip.client) return "Select a client";
  if (trip.travellers_confirmed === false) return "Name the travellers";
  if (!trip.starts_on || !trip.ends_on) return "Set the trip dates";
  if (trip.legs_confirmed === false) return "List each stay";
  if (!stayComplete(trip)) return "Set hotel & party";
  if (!ratesComplete(trip)) return "Select a rate";
  return "Review bookings";
}

/** Explicit gaps the model should treat as unknown / incomplete. */
export function listTripGaps(trip: TripFacts): string[] {
  const gaps: string[] = [];

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
      if (stay.property_name && !stay.rate_selected) {
        gaps.push(`${label}: no rate selected`);
      }
    });
  }

  if (stays.length === 0 && !trip.rates.selected) {
    gaps.push("No rate selected");
  }

  if (trip.rates.selected && trip.quote.sell_total == null) {
    gaps.push("Client sell price not set");
  }

  return gaps;
}
