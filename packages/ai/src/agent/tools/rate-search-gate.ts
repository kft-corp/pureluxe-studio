import { rateMessages, roomCountAskForParty } from "@pureluxe/shared";

import type { TripFacts } from "../../types";

export type RateSearchRoomOccupancy = {
  adults: number;
  children?: number;
  childAges?: number[];
};

/**
 * True when party size makes a wrong room guess costly (families / crowded / odd adults).
 * Used for copy hints only — rooms are always required before rates when unset.
 */
export function needsExplicitRoomCount(adults: number, children: number): boolean {
  const adultN = Math.max(0, Math.floor(adults || 0));
  const childN = Math.max(0, Math.floor(children || 0));
  if (childN > 0 || adultN + childN >= 4) return true;
  if (adultN >= 3 && adultN % 2 !== 0) return true;
  return false;
}

export type RateSearchGateInput = {
  check_in: string;
  check_out: string;
  rooms?: number;
  adults: number;
  children?: number;
  /** Destination / city for this rates search — picks the matching stay on multi-city trips. */
  destination?: string | null;
  /** One entry per room when rooms > 1 and children > 0. */
  room_occupancies?: RateSearchRoomOccupancy[];
};

export type RateSearchResolved = {
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  infants: number;
  roomOccupancies?: RateSearchRoomOccupancy[];
};

type TripStayDates = {
  city: string;
  check_in: string | null;
  check_out: string | null;
  rooms?: number | null;
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

/** Adult / child / infant counts from trip travellers. Null when no adult on the trip. */
export function partyFromTrip(
  trip: TripFacts | null,
): { adults: number; children: number; infants: number } | null {
  const travellers = trip?.travellers ?? [];
  if (travellers.length === 0) return null;
  const adults = travellers.filter((person) => person.party_role === "adult").length;
  const children = travellers.filter((person) => person.party_role === "child").length;
  const infants = travellers.filter((person) => person.party_role === "infant").length;
  if (adults < 1) return null;
  return { adults, children, infants };
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
  const infants = tripParty?.infants ?? 0;
  const childCount = Math.max(0, children);
  const infantCount = Math.max(0, infants);
  const adultsN =
    Number.isInteger(adults) && (adults as number) >= 1 ? (adults as number) : null;
  // Saved rooms on the destination stay (or the only stay). Never invent ceil(adults/2).
  const singleStay =
    trip?.stays?.length === 1
      ? trip.stays[0]
      : trip?.stay && !(trip.stays && trip.stays.length > 1)
        ? trip.stay
        : null;
  const stayRoomsRaw = matchedStay?.rooms ?? singleStay?.rooms ?? null;
  const stayRooms =
    stayRoomsRaw != null && Number.isInteger(stayRoomsRaw) && stayRoomsRaw >= 1
      ? stayRoomsRaw
      : null;
  const explicitRooms =
    input.rooms && Number.isInteger(input.rooms) && input.rooms >= 1
      ? input.rooms
      : null;

  // Advisor this turn → saved stay.rooms. Never default behind the scenes.
  const rooms: number | null = explicitRooms ?? stayRooms ?? null;

  const missing: string[] = [];
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
    missing.push("check-in and check-out dates");
  } else if (checkOut <= checkIn) {
    missing.push("check-out after check-in");
  }
  if (adultsN == null) {
    missing.push("adult traveller count");
  }
  if (rooms == null || !Number.isInteger(rooms) || rooms < 1) {
    missing.push("room count");
  }

  if (missing.length > 0) {
    const roomOnly = missing.length === 1 && missing[0] === "room count";
    const roomAsk =
      adultsN != null
        ? roomCountAskForParty({
            adults: adultsN,
            children: childCount + infantCount,
            destination: input.destination,
          })
        : rateMessages.error.roomCountRequired;
    if (roomOnly) {
      return {
        error:
          `Cannot search rates yet — need room count. ${roomAsk} ` +
          "Ask once in plain text with that suggestion (do not invent a number). " +
          "After they answer, pass rooms on rates_search and trip_set_stays with that rooms value so the summary sidebar shows it. " +
          "Do not call rates_search again until they answer.",
        missing,
      };
    }
    const roomHint = missing.includes("room count")
      ? ` For rooms: ${roomAsk} After they answer, pass rooms on rates_search and trip_set_stays.`
      : "";
    return {
      error:
        `Cannot search rates yet — need ${missing.join(", ")}. ` +
        "Ask the advisor once in plain text for the missing details. " +
        "Do not invent stay dates, party counts, or room count." +
        roomHint +
        " Do not call rates_search again until they answer.",
      missing,
    };
  }

  const resolvedRooms = rooms as number;
  const resolvedAdults = adultsN as number;
  const roomOccupancies = input.room_occupancies;

  if (resolvedRooms > 1 && resolvedAdults < resolvedRooms) {
    return {
      error:
        "Cannot search rates yet — each room needs at least one adult. " +
        "Ask the advisor to adjust rooms or party. Do not invent a split.",
      missing: ["adults per room"],
    };
  }

  // Adults-only uneven across rooms: need an explicit per-room split (e.g. 2+1).
  // Studio dual-shops Sabre once confirmed — never invent the layout.
  if (
    resolvedRooms > 1 &&
    childCount === 0 &&
    resolvedAdults % resolvedRooms !== 0 &&
    (!roomOccupancies || roomOccupancies.length === 0)
  ) {
    return {
      error:
        "Cannot search rates yet — this adult party does not divide evenly across those rooms. " +
        "Ask who sleeps in each room (e.g. 2 adults in one and 1 in the other), change rooms, or paste a quote. Do not invent a split.",
      missing: ["room occupancy split"],
    };
  }

  // Multi-room + kids: even party → Studio auto matching split. Uneven → ask for
  // per-room layout (mixed OK once confirmed; Sabre prices as separate shops).
  if (
    resolvedRooms > 1 &&
    childCount > 0 &&
    (!roomOccupancies || roomOccupancies.length === 0)
  ) {
    const even =
      resolvedAdults % resolvedRooms === 0 &&
      childCount % resolvedRooms === 0 &&
      resolvedAdults / resolvedRooms >= 1;
    if (!even) {
      return {
        error:
          "Cannot search rates yet — this party does not divide evenly across those rooms. " +
          "Ask who sleeps in each room (adults, children, ages) — matching or mixed layouts both work once confirmed — or paste a hotel quote. Do not invent a split.",
        missing: ["room occupancy split"],
      };
    }
  }

  return {
    checkIn,
    checkOut,
    rooms: resolvedRooms,
    adults: resolvedAdults,
    children: childCount,
    infants: infantCount,
    ...(roomOccupancies && roomOccupancies.length > 0
      ? { roomOccupancies }
      : {}),
  };
}
