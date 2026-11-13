import type { TripFacts } from "../../types";

export type RateSearchGateInput = {
  check_in: string;
  check_out: string;
  rooms?: number;
  adults: number;
  children?: number;
};

export type RateSearchResolved = {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
};

/** Trip dates: trip window, else first stay with both dates. */
export function datesFromTrip(trip: TripFacts | null): { checkIn: string; checkOut: string } | null {
  if (trip?.starts_on && trip?.ends_on) {
    return { checkIn: trip.starts_on, checkOut: trip.ends_on };
  }
  const stay =
    trip?.stays?.find((row) => row.check_in && row.check_out) ??
    (trip?.stay?.check_in && trip?.stay?.check_out ? trip.stay : null);
  if (stay?.check_in && stay?.check_out) {
    return { checkIn: stay.check_in, checkOut: stay.check_out };
  }
  return null;
}

/** Adult / child counts from trip travellers. Null when no adult on the trip. */
export function partyFromTrip(trip: TripFacts | null): { adults: number; children: number } | null {
  const travellers = trip?.travellers ?? [];
  if (travellers.length === 0) return null;
  const adults = travellers.filter((person) => person.party_role === "adult").length;
  const children = travellers.filter(
    (person) => person.party_role === "child" || person.party_role === "infant",
  ).length;
  if (adults < 1) return null;
  return { adults, children };
}

/**
 * Prefer trip facts for dates/party; fill rooms from input or 1 per two adults.
 * Returns `{ error, missing }` when check-in/out, adults, or rooms cannot be resolved
 * without inventing — agent must ask once.
 */
export function resolveRateSearchInput(
  input: RateSearchGateInput,
  trip: TripFacts | null,
): RateSearchResolved | { error: string; missing: string[] } {
  const tripDates = datesFromTrip(trip);
  const tripParty = partyFromTrip(trip);

  const checkIn = tripDates?.checkIn ?? input.check_in?.trim() ?? "";
  const checkOut = tripDates?.checkOut ?? input.check_out?.trim() ?? "";
  const adults = tripParty?.adults ?? input.adults;
  const children = tripParty?.children ?? input.children ?? 0;
  const rooms =
    input.rooms && input.rooms >= 1
      ? input.rooms
      : Math.max(1, Math.ceil((adults || 0) / 2));

  const missing: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    missing.push("check-in and check-out dates");
  } else if (checkOut <= checkIn) {
    missing.push("check-out after check-in");
  }
  if (!Number.isInteger(adults) || adults < 1) {
    missing.push("adult traveller count");
  }
  if (!Number.isInteger(rooms) || rooms < 1) {
    missing.push("room count");
  }
  // children may be 0 — only flag when trip has minors with unknown age and rates need ages
  // (handled in prompts); count itself can be 0.

  if (missing.length > 0) {
    return {
      error:
        `Cannot search rates yet — need ${missing.join(", ")}. ` +
        "Ask the advisor once in plain text for the missing details. " +
        "Do not invent stay dates or party counts. Do not call rates_search again until they answer.",
      missing,
    };
  }

  return {
    checkIn,
    checkOut,
    rooms,
    adults: adults as number,
    children: Math.max(0, children),
  };
}
