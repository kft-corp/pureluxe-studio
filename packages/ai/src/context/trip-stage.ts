import type { TripBuilderStage, TripFacts } from "../types";

function stayComplete(trip: TripFacts): boolean {
  return Boolean(
    trip.stay?.check_in && trip.stay.check_out && trip.stay.property_name,
  );
}

/** Derive Phase 1 stage from trip facts (same rules as Studio UI). */
export function resolveTripStage(trip: TripFacts): TripBuilderStage {
  if (!trip.client) return "client";
  if (!stayComplete(trip)) return "stay";
  if (!trip.rates.selected) return "rates";
  if (trip.quote.document_status === "ready") return "quote";
  return "package";
}

/** Short next-step hint for prompts / UI. */
export function resolveNextStep(trip: TripFacts): string {
  if (!trip.client) return "Select a client";
  if (!stayComplete(trip)) return "Set hotel & dates";
  if (!trip.rates.selected) return "Select a rate";
  if (trip.quote.document_status !== "ready") {
    return "Generate quote PDF";
  }
  return "Open quote PDF";
}

/** Explicit gaps the model should treat as unknown / incomplete. */
export function listTripGaps(trip: TripFacts): string[] {
  const gaps: string[] = [];

  if (!trip.client) gaps.push("Client not assigned");

  if (!trip.stay) {
    gaps.push("Stay not set (hotel, city, dates)");
  } else {
    if (!trip.stay.property_name) gaps.push("Hotel name missing");
    if (!trip.stay.city.trim()) gaps.push("City missing");
    if (!trip.stay.check_in || !trip.stay.check_out) {
      gaps.push("Check-in/out dates incomplete");
    }
  }

  if (!trip.rates.selected) {
    gaps.push("No rate selected");
  }

  if (trip.rates.selected && trip.quote.sell_total == null) {
    gaps.push("Client sell price not set");
  }

  if (trip.rates.selected && trip.quote.document_status !== "ready") {
    gaps.push("Quote PDF not generated yet");
  }

  return gaps;
}
