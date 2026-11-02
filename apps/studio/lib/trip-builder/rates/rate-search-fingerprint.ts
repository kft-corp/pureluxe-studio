import type { StoredRateSearch } from "@pureluxe/db";

/** Stable key so we can skip re-showing the rate card when search context is unchanged. */
function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function hotelNamesMatch(a: string, b: string): boolean {
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

/**
 * Trip search context only (dates, party, rooms, hotel set).
 * Room costs are omitted — live rates can tick slightly and must not re-open the table
 * after markup / sell changes (founder #5).
 */
function buildFingerprint(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: string[];
}): string {
  const hotelKey = [...input.hotels].map(norm).filter(Boolean).sort().join("|");
  return [
    norm(input.destination),
    input.checkIn,
    input.checkOut,
    String(input.adults),
    String(input.children),
    String(input.rooms),
    hotelKey,
  ].join("\n");
}

type OutcomeForFingerprint = {
  hotel: string;
};

/** Fingerprint of a just-finished multi-hotel search. */
export function fingerprintFromOutcomes(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: OutcomeForFingerprint[];
}): string {
  return buildFingerprint({
    destination: input.destination,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    hotels: input.hotels.map((hotel) => hotel.hotel),
  });
}

function hotelsFromStored(search: StoredRateSearch): string[] {
  const metaHotels = Array.isArray(search.event.meta?.hotels)
    ? search.event.meta.hotels.filter((name): name is string => typeof name === "string")
    : [];
  if (metaHotels.length > 0) return metaHotels;
  return [
    ...new Set(
      search.results
        .map((row) => row.property_name)
        .filter((name): name is string => Boolean(name?.trim())),
    ),
  ];
}

/** Fingerprint of the trip's previous open rate search. */
export function fingerprintFromStored(search: StoredRateSearch): string {
  return buildFingerprint({
    destination: search.event.destination_text ?? "",
    checkIn: search.event.check_in ?? "",
    checkOut: search.event.check_out ?? "",
    adults: search.event.adults ?? 0,
    children: search.event.children ?? 0,
    rooms: search.event.rooms ?? 0,
    hotels: hotelsFromStored(search),
  });
}

export type RateSearchContext = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: string[];
};

function samePartyAndDates(
  previous: StoredRateSearch,
  next: Omit<RateSearchContext, "hotels">,
): boolean {
  return (
    norm(previous.event.destination_text ?? "") === norm(next.destination) &&
    (previous.event.check_in ?? "") === next.checkIn &&
    (previous.event.check_out ?? "") === next.checkOut &&
    (previous.event.adults ?? 0) === next.adults &&
    (previous.event.children ?? 0) === next.children &&
    (previous.event.rooms ?? 0) === next.rooms
  );
}

/** True when every requested hotel was already in the previous search. */
export function hotelsCoveredByPrevious(
  previousHotels: string[],
  requestedHotels: string[],
): boolean {
  if (requestedHotels.length === 0) return true;
  return requestedHotels.every((requested) =>
    previousHotels.some((previous) => hotelNamesMatch(previous, requested)),
  );
}

/**
 * Same dates/party/rooms/destination and requested hotels ⊆ previous hotel set.
 * Markup-only turns often re-call rates_search for one hotel already on screen —
 * treat that as covered so we do not re-show the table or overwrite the multi-hotel snapshot.
 */
export function previousSearchCoversRequest(
  previous: StoredRateSearch,
  next: RateSearchContext,
): boolean {
  if (!samePartyAndDates(previous, next)) return false;
  return hotelsCoveredByPrevious(hotelsFromStored(previous), next.hotels);
}

/** Show the rate card only when context is new or the hotel set grew / changed. */
export function shouldShowCompareCard(input: {
  previous: StoredRateSearch | null;
  next: RateSearchContext;
}): boolean {
  if (!input.previous) return true;
  if (previousSearchCoversRequest(input.previous, input.next)) return false;
  return fingerprintFromStored(input.previous) !== buildFingerprint(input.next);
}
