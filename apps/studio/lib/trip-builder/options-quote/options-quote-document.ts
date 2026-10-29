import { getCurrencyName } from "@pureluxe/shared";

import type { TripDetail, TripRateSnapshot, TripStaySnapshot } from "../trip/trip-detail";

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
  /** Meal plan for the Meal plan column (Half Board, Bed and Breakfast, …). */
  detail: string | null;
  /** Amount only. The PDF paints the currency symbol beside it. */
  price: string;
  currency: string | null;
  /** Max occupancy for the optional Occupancy column, e.g. "Up to 3 adults, 1 child". */
  sleeps: string | null;
  /** Units · guests (or villa · bedrooms) for this option, e.g. "2 rooms · 4 adults". */
  party: string | null;
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
  const occupancy = stayPartyLabel(stay);
  const hotels = [...byHotel.entries()].map(([name, rooms]) => ({
    name,
    city: stay.city.trim(),
    propertyId: rooms.find((row) => row.property_id)?.property_id ?? stay.property_id,
    arrival: [] as string[],
    transfers: [] as string[],
    shared: [] as string[],
    rooms: rooms.map((row) => roomLine(row, stay)),
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
    occupancy: occupancy || "Not set",
    hotels,
  };
}

/** Common board codes → client wording on the PDF. */
const BOARD_LABEL: Record<string, string> = {
  ro: "Room Only",
  ep: "Room Only",
  bb: "Bed and Breakfast",
  hb: "Half Board",
  fb: "Full Board",
  ai: "All Inclusive",
  uai: "Ultra All Inclusive",
};

function expandBoardLabel(part: string): string {
  const key = part.trim().toLowerCase().replace(/\./g, "");
  return BOARD_LABEL[key] ?? part.trim();
}

function roomLine(row: TripRateSnapshot, stay: TripStaySnapshot): OptionsQuoteRoom {
  const currency = row.currency?.trim() || null;
  const raw = row.subtitle?.trim() || row.title.trim();
  const [name, ...rest] = raw.split(/\s*·\s*/);
  return {
    id: row.id,
    name: name?.trim() || "Room",
    detail:
      rest
        .map((part) => expandBoardLabel(part))
        .filter(Boolean)
        .join(", ") || null,
    price: row.sell_amount == null ? "To be confirmed" : formatAmount(row.sell_amount),
    currency,
    sleeps: sleepsLabel(row.max_adults, row.max_children),
    party: optionPartyLabel(row, stay),
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

/** Client label for room capacity. Null when the rate has no max occupancy. */
function sleepsLabel(maxAdults: number | null, maxChildren: number | null): string | null {
  const parts: string[] = [];
  if (maxAdults != null && maxAdults > 0) {
    parts.push(maxAdults === 1 ? "1 adult" : `${maxAdults} adults`);
  }
  if (maxChildren != null && maxChildren > 0) {
    parts.push(maxChildren === 1 ? "1 child" : `${maxChildren} children`);
  }
  if (parts.length === 0) return null;
  return `Up to ${parts.join(", ")}`;
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
    const code = codes[0]!;
    const name = getCurrencyName(code);
    return `All prices in ${name ? `${name} (${code})` : code} for the full stay · Subject to availability`;
  }
  if (codes.length > 1) {
    const labels = codes.map((code) => getCurrencyName(code) ?? code);
    return `Prices are in ${labels.join(" or ")} for the full stay · Subject to availability`;
  }
  return "Prices are for the full stay · Subject to availability";
}

function partyBits(adults: number | null, children: number | null): string {
  const parts: string[] = [];
  if (adults) parts.push(adults === 1 ? "1 adult" : `${adults} adults`);
  if (children) parts.push(children === 1 ? "1 child" : `${children} children`);
  return parts.join(", ");
}

/** e.g. "2 rooms · 4 adults" for the stay Occupancy field. */
function stayPartyLabel(stay: TripStaySnapshot): string | null {
  const guests = partyBits(stay.adults, stay.children);
  const rooms =
    stay.rooms != null && stay.rooms > 0
      ? stay.rooms === 1
        ? "1 room"
        : `${stay.rooms} rooms`
      : null;
  if (rooms && guests) return `${rooms} · ${guests}`;
  return rooms || guests || null;
}

const BEDROOM_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

/** Bedroom count from a room name, e.g. "Two Bedroom Beach Villa" → 2. */
function bedroomCount(name: string): number | null {
  const digit =
    name.match(/\b(\d+)\s*[-–]?\s*bed(?:room)?s?\b/i) ?? name.match(/\b(\d+)\s*br\b/i);
  if (digit) {
    const n = Number(digit[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const word = name.match(/\b(one|two|three|four|five|six)\s*[-–]?\s*bed(?:room)?s?\b/i);
  if (!word?.[1]) return null;
  return BEDROOM_WORDS[word[1].toLowerCase()] ?? null;
}

function unitKind(name: string): "villa" | "suite" | null {
  if (/\bvillas?\b/i.test(name)) return "villa";
  if (/\bsuites?\b/i.test(name)) return "suite";
  return null;
}

function optionRoomName(row: TripRateSnapshot): string {
  const raw = row.subtitle?.trim() || row.title.trim();
  return raw.split(/\s*·\s*/)[0]?.trim() || raw;
}

/**
 * Per-option party line for the PDF.
 * Multi-bed villa/suite → "1 villa · 2 bedrooms"; other villas → "2 villas · 4 adults";
 * else stay rooms · guests.
 */
function optionPartyLabel(row: TripRateSnapshot, stay: TripStaySnapshot): string | null {
  const name = optionRoomName(row);
  const beds = bedroomCount(name);
  const kind = unitKind(name);
  const guests = partyBits(stay.adults, stay.children);

  if (beds != null && beds >= 2 && kind) {
    const bedLabel = beds === 1 ? "1 bedroom" : `${beds} bedrooms`;
    return `1 ${kind} · ${bedLabel}`;
  }

  if (kind) {
    const count = stay.rooms != null && stay.rooms > 0 ? stay.rooms : 1;
    const unit = count === 1 ? `1 ${kind}` : `${count} ${kind}s`;
    if (guests) return `${unit} · ${guests}`;
    return unit;
  }

  return stayPartyLabel(stay);
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
