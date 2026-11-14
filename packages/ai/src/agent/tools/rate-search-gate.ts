import type { TripFacts } from "../../types";

export type RateSearchGateInput = {
  check_in: string;
  check_out: string;
  rooms?: number;
  adults: number;
  children?: number;
  /** Destination / city for this rates search — picks the matching stay on multi-city trips. */
  destination?: string | null;
};

export type RateSearchResolved = {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
};

type TripStayDates = {
  city: string;
  check_in: string | null;
  check_out: string | null;
};

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasStayDates(
  stay: TripStayDates | null | undefined,
): stay is TripStayDates & { check_in: string; check_out: string } {
  return Boolean(
    stay?.check_in &&
      stay?.check_out &&
      isIsoDate(stay.check_in) &&
      isIsoDate(stay.check_out) &&
      stay.check_out > stay.check_in,
  );
}

function normPlace(value: string): string {
  return value.trim().toLowerCase();
}

/** Stay whose city matches the rates destination (e.g. Maldives on a Tokyo+Maldives trip). */
function stayMatchingDestination(
  trip: TripFacts | null,
  destination?: string | null,
): TripStayDates | null {
  const place = destination?.trim();
  if (!place || !trip) return null;
  const needle = normPlace(place);
  const stays: TripStayDates[] = [
    ...(trip.stays ?? []),
    ...(trip.stay ? [trip.stay] : []),
  ];
  const match = stays.find((stay) => {
    const city = stay.city?.trim();
    if (!city) return false;
    const hay = normPlace(city);
    return hay === needle || hay.includes(needle) || needle.includes(hay);
  });
  return match ?? null;
}

/**
 * Dates for a rates search: matching stay by destination → open/first stay → trip window.
 * Never prefer the full trip window when a stay for that destination exists (multi-city).
 */
export function datesFromTrip(
  trip: TripFacts | null,
  destination?: string | null,
): { checkIn: string; checkOut: string } | null {
  const matched = stayMatchingDestination(trip, destination);
  if (hasStayDates(matched)) {
    return { checkIn: matched.check_in, checkOut: matched.check_out };
  }

  const open = trip?.stay;
  if (hasStayDates(open)) {
    return { checkIn: open.check_in, checkOut: open.check_out };
  }

  const first =
    trip?.stays?.find((row) => hasStayDates(row)) ??
    null;
  if (hasStayDates(first)) {
    return { checkIn: first.check_in, checkOut: first.check_out };
  }

  if (trip?.starts_on && trip?.ends_on && isIsoDate(trip.starts_on) && isIsoDate(trip.ends_on)) {
    return { checkIn: trip.starts_on, checkOut: trip.ends_on };
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
 * Resolve dates/party for rates_search.
 * Dates: destination-matched stay wins over a full trip window; explicit input wins when it
 * is not just the whole-trip starts_on/ends_on on a multi-stay trip. Never invent.
 */
export function resolveRateSearchInput(
  input: RateSearchGateInput,
  trip: TripFacts | null,
): RateSearchResolved | { error: string; missing: string[] } {
  const inputIn = input.check_in?.trim() ?? "";
  const inputOut = input.check_out?.trim() ?? "";
  const inputDatesOk =
    isIsoDate(inputIn) && isIsoDate(inputOut) && inputOut > inputIn
      ? { checkIn: inputIn, checkOut: inputOut }
      : null;

  const tripWindow =
    trip?.starts_on &&
    trip?.ends_on &&
    isIsoDate(trip.starts_on) &&
    isIsoDate(trip.ends_on) &&
    trip.ends_on > trip.starts_on
      ? { checkIn: trip.starts_on, checkOut: trip.ends_on }
      : null;

  const matchedStay = stayMatchingDestination(trip, input.destination);
  const matchedDates = hasStayDates(matchedStay)
    ? { checkIn: matchedStay.check_in, checkOut: matchedStay.check_out }
    : null;

  const inputIsWholeTrip =
    Boolean(inputDatesOk && tripWindow) &&
    inputDatesOk!.checkIn === tripWindow!.checkIn &&
    inputDatesOk!.checkOut === tripWindow!.checkOut;

  // Multi-city: Maldives destination + Maldives stay → use that stay, not Tokyo→Maldives window.
  const tripDates = datesFromTrip(trip, input.destination);
  const preferred =
    matchedDates && (inputIsWholeTrip || !inputDatesOk)
      ? matchedDates
      : (inputDatesOk ?? tripDates);

  const tripParty = partyFromTrip(trip);

  const checkIn = preferred?.checkIn ?? "";
  const checkOut = preferred?.checkOut ?? "";
  const adults = tripParty?.adults ?? input.adults;
  const children = tripParty?.children ?? input.children ?? 0;
  const rooms =
    input.rooms && input.rooms >= 1
      ? input.rooms
      : Math.max(1, Math.ceil((adults || 0) / 2));

  const missing: string[] = [];
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
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
