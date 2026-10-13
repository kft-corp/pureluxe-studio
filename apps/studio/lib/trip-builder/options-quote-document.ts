import type { TripDetail, TripRateSnapshot, TripStaySnapshot } from "./trip-detail";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type OptionsQuoteStay = {
  city: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInLabel: string;
  checkOutLabel: string;
  when: string;
  occupancy: string;
  hotels: OptionsQuoteHotel[];
};

export type OptionsQuoteHotel = {
  name: string;
  city: string;
  propertyId: string | null;
  /** Check-in and check-out times that match every room. */
  arrival: string[];
  /** Transfers that match every room. */
  transfers: string[];
  /** Stay rules, benefits, charges, and notes that match every room. */
  shared: string[];
  rooms: OptionsQuoteRoom[];
};

export type OptionsQuoteRoom = {
  /** Saved option row. Line edits use this id. */
  id: string;
  name: string;
  /** Board or other short line under the room name. */
  detail: string | null;
  /** Amount only. The column heading carries the currency when every room shares one. */
  price: string;
  currency: string | null;
  inclusions: string[];
  /** Cancel rule for these dates only. Null when the stored text is for other seasons. */
  cancellation: string | null;
  /** Payment rule for these dates only. */
  payment: string | null;
  /** Full printed cancel line, when the advisor rewrote it. */
  terms: string | null;
  /** Room note that is safe to show the client. */
  note: string | null;
  /** Contract and season used to load this room's rules. Not printed. */
  contractId: string | null;
  season: string | null;
  /** Benefits, charges, and notes that are not true for every room at this hotel. */
  extras: string[];
};

/** Sentence under the price basis. The advisor can rewrite it. The letterhead cannot. */
export const OPTIONS_QUOTE_NOTICE =
  "Each total is an offer for that room. It does not hold the reservation. Availability and price can change before booking.";

/** One options quote, filled from the open trip. The PDF painter reads this and nothing else. */
export type OptionsQuoteDocument = {
  title: string;
  subtitle: string;
  preparedFor: string;
  dates: string;
  guests: string;
  basis: string;
  notice: string;
  stays: OptionsQuoteStay[];
  notes: string | null;
};

/**
 * Rooms that belong on the options quote.
 * Every priced room on a stay is listed. After a reopened quote, the client's earlier
 * choice sits next to the new options, so it comes first.
 */
export function roomsForOptionsQuote(detail: TripDetail): TripRateSnapshot[] {
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const rooms: TripRateSnapshot[] = [];
  for (const stay of stays) {
    const onStay = detail.rates.candidates.filter((row) => row.leg_id === stay.leg_id);
    rooms.push(
      ...onStay.filter((row) => row.selected),
      ...onStay.filter((row) => !row.selected),
    );
  }
  return rooms;
}

/** Map the saved trip, stays, and quote rooms into the options quote. */
export function optionsQuoteFromTrip(
  detail: TripDetail,
  notes: string | null,
  title: string | null,
): OptionsQuoteDocument {
  const stays = detail.stays.length > 0 ? detail.stays : detail.stay ? [detail.stay] : [];
  const quoted = roomsForOptionsQuote(detail);
  const blocks = stays
    .map((stay) => stayBlock(stay, quoted.filter((row) => row.leg_id === stay.leg_id)))
    .filter((stay) => stay.hotels.length > 0);
  const guests = guestLine(detail);
  return {
    title: title?.trim() || detail.trip.title?.trim() || "Hotel options",
    subtitle: stays.map((stay) => stay.city.trim()).filter(Boolean).join(" | ") || "Your stay",
    preparedFor: detail.client?.display_name?.trim() || guests,
    dates: tripDateLine(detail, stays),
    guests,
    basis: basisLine(blocks),
    notice: OPTIONS_QUOTE_NOTICE,
    stays: blocks,
    notes,
  };
}

function stayBlock(stay: TripStaySnapshot, rows: TripRateSnapshot[]): OptionsQuoteStay {
  const byHotel = new Map<string, TripRateSnapshot[]>();
  for (const row of rows) {
    const name = row.property_name?.trim() || stay.property_name?.trim() || "Hotel";
    const list = byHotel.get(name) ?? [];
    list.push(row);
    byHotel.set(name, list);
  }
  const checkIn = stay.check_in;
  const checkOut = stay.check_out;
  const hotels = [...byHotel.entries()].map(([name, rooms]) => ({
    name,
    city: stay.city.trim(),
    propertyId: rooms.find((row) => row.property_id)?.property_id ?? stay.property_id,
    arrival: [] as string[],
    transfers: [] as string[],
    shared: [] as string[],
    rooms: rooms.map(roomLine),
  }));
  const hotelLabel = hotels.length === 1 ? "one hotel" : `${hotels.length} hotels`;
  const roomCount = hotels.reduce((sum, hotel) => sum + hotel.rooms.length, 0);
  const roomLabel = roomCount === 1 ? "one room" : `${roomCount} rooms`;
  const when = [formatDate(checkIn), formatDate(checkOut)].filter(Boolean).join(" - ");
  return {
    city: stay.city.trim() || "Stay",
    checkIn,
    checkOut,
    checkInLabel: formatDate(checkIn) || "not set",
    checkOutLabel: formatDate(checkOut) || "not set",
    when: [when, nightCount(checkIn, checkOut), `${hotelLabel}, ${roomLabel}`]
      .filter(Boolean)
      .join(" | "),
    occupancy: partyBits(stay.adults, stay.children) || "Not set",
    hotels,
  };
}

function roomLine(row: TripRateSnapshot): OptionsQuoteRoom {
  const currency = row.currency?.trim() || null;
  const raw = row.subtitle?.trim() || row.title.trim();
  const [name, ...rest] = raw.split(/\s*·\s*/);
  return {
    id: row.id,
    name: name?.trim() || "Room",
    detail: rest.map((part) => part.trim()).filter(Boolean).join(", ") || null,
    price: row.sell_amount == null ? "To be confirmed" : formatAmount(row.sell_amount),
    currency,
    inclusions: clientInclusions(row.inclusions),
    cancellation: clientRule(row.cancellation_policy, row.season_code),
    payment: clientRule(row.payment_policy, row.season_code),
    terms: null,
    note: clientNote(row.rate_note),
    contractId: row.contract_id,
    season: row.season_code?.trim() || null,
    extras: [],
  };
}

const SEASON_LABEL = /^(peak|high|low|shoulder|other)\s*:\s*/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * One sentence for this stay. A list of every season stays off the client PDF.
 * "Shoulder: cancel within 21 days..." becomes "Cancel within 21 days...".
 */
function clientRule(text: string | null, season: string | null): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  const parts = raw
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const labelled = parts.filter((part) => SEASON_LABEL.test(part));
  let chosen: string | null = null;
  if (season) {
    const key = new RegExp(`^${escapeRegExp(season.trim())}\\s*:`, "i");
    chosen = parts.find((part) => key.test(part)) ?? null;
  } else if (labelled.length === 0) {
    chosen = parts.join(" ");
  } else if (parts.length === 1) {
    chosen = parts[0] ?? null;
  }
  if (!chosen) return null;
  const stripped = chosen
    .replace(season ? new RegExp(`^${escapeRegExp(season.trim())}\\s*:\\s*`, "i") : SEASON_LABEL, "")
    .trim();
  if (!stripped) return null;
  const sentence = `${stripped.charAt(0).toUpperCase()}${stripped.slice(1)}`;
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

function clientNote(text: string | null): string | null {
  const raw = text?.trim();
  if (!raw) return null;
  if (
    /\b(?:markup|confidential|advisor|ota|bedbank|payout|commission|booking code|wholesale|net|market only|new bookings?|combinable|contracted|tactical|separate quote|rate-based|villa rate|listed categories)\b|@/i.test(
      raw,
    )
  ) {
    return null;
  }
  return raw.endsWith(".") ? raw : `${raw}.`;
}

function clientInclusions(items: string[]): string[] {
  const hidden = /\b(?:markup|confidential|advisor|ota|bedbank|payout|commission)\b/i;
  return [...new Set(items.map((item) => item.trim()).filter((item) => item && !hidden.test(item)))];
}

function guestLine(detail: TripDetail): string {
  const names = detail.travellers.map((person) => person.display_name.trim()).filter(Boolean);
  return names.join(", ") || "Guests not set";
}

function tripDateLine(detail: TripDetail, stays: TripStaySnapshot[]): string {
  const start = detail.trip.starts_on || stays.find((stay) => stay.check_in)?.check_in || null;
  const end = detail.trip.ends_on || [...stays].reverse().find((stay) => stay.check_out)?.check_out || null;
  const span = [formatDate(start), formatDate(end)].filter(Boolean).join(" - ");
  const nights = nightCount(start, end);
  return [span, nights].filter(Boolean).join(" | ") || "Dates not set";
}

function basisLine(stays: OptionsQuoteStay[]): string {
  const codes = [
    ...new Set(
      stays.flatMap((stay) =>
        stay.hotels.flatMap((hotel) =>
          hotel.rooms.map((room) => room.currency).filter((code): code is string => Boolean(code)),
        ),
      ),
    ),
  ];
  if (codes.length === 1) {
    return `All prices in ${codes[0]} for the full stay · Subject to availability`;
  }
  if (codes.length > 1) {
    return `Prices are in ${codes.join(" or ")} for the full stay · Subject to availability`;
  }
  return "Prices are for the full stay · Subject to availability";
}

function partyBits(adults: number | null, children: number | null): string {
  const parts: string[] = [];
  if (adults) parts.push(adults === 1 ? "1 adult" : `${adults} adults`);
  if (children) parts.push(children === 1 ? "1 child" : `${children} children`);
  return parts.join(", ");
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function nightCount(checkIn: string | null, checkOut: string | null): string {
  if (!checkIn || !checkOut) return "";
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return "";
  const nights = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
  if (nights <= 0) return "";
  return nights === 1 ? "1 night" : `${nights} nights`;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}
