import { getCurrencyName } from "@pureluxe/shared";

import { normRoomKey } from "@/lib/rates/room-match";

import { boardClientLabel, toClientLine } from "./client-wording";
import { clientOptionChips } from "./option-chips";
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

/** One physical room inside a dual-shop combo (client PDF). */
export type OptionsQuoteRoomSegment = {
  /** e.g. "Twin (2 adults)" — room type + who sleeps there. */
  label: string;
  roomName: string;
  /** Meal plan for this room only. */
  board: string | null;
  /** Compact chips: Occupancy · Non-refund · Deposit. */
  chips: string | null;
  cancellation: string | null;
  payment: string | null;
};

export type OptionsQuoteRoom = {
  /** Saved option row. Line edits use this id. */
  id: string;
  name: string;
  /**
   * Client chips under the room name (same idea as chat rate table),
   * e.g. "Occupancy 3 · Non-refund · Deposit".
   */
  chips: string | null;
  /** Meal plan for the Meal plan column (Half Board, Bed and Breakfast, …). */
  detail: string | null;
  /** Amount only. The PDF paints the currency symbol beside it. */
  price: string;
  currency: string | null;
  /** Max occupancy for the optional Occupancy column, e.g. "Up to 3 adults, 1 child". */
  sleeps: string | null;
  /** Units · guests (or villa · bedrooms) for this option, e.g. "2 rooms · 4 adults". */
  party: string | null;
  /**
   * Dual-shop combo rooms (Room A / Room B). Null for single-room options.
   * PDF nests these under the combo title so the client sees each room clearly.
   */
  segments: OptionsQuoteRoomSegment[] | null;
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
  const preparedFor = detail.client?.display_name?.trim() || guests;
  return {
    title: title?.trim() || detail.trip.title?.trim() || "Hotel options",
    subtitle: stays.map((stay) => stay.city.trim()).filter(Boolean).join(" | ") || "Your stay",
    preparedFor,
    dates: tripDateLine(detail, stays),
    // Empty when same as Prepared for — PDF omits the Guests row.
    guests: sameClientText(preparedFor, guests) ? "" : guests,
    basis: basisLine(blocks),
    notice: OPTIONS_QUOTE_NOTICE,
    stays: blocks,
    notes,
  };
}

function sameClientText(left: string, right: string): boolean {
  const a = left.trim().toLowerCase().replace(/\s+/g, " ");
  const b = right.trim().toLowerCase().replace(/\s+/g, " ");
  return Boolean(a) && a === b;
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
  const hotels = [...byHotel.entries()].map(([name, hotelRows]) => ({
    name,
    city: stay.city.trim(),
    propertyId: hotelRows.find((row) => row.property_id)?.property_id ?? stay.property_id,
    arrival: [] as string[],
    transfers: [] as string[],
    shared: [] as string[],
    rooms: disambiguateDuplicateRoomNames(
      hotelRows.map((row) => roomLine(row, stay)),
      hotelRows,
    ),
  }));
  const hotelLabel = hotels.length === 1 ? "one hotel" : `${hotels.length} hotels`;
  // Quote rows are rate options, not physical room units (units live under Occupancy).
  const optionCount = hotels.reduce((sum, hotel) => sum + hotel.rooms.length, 0);
  const optionLabel = optionCount === 1 ? "one option" : `${optionCount} options`;
  const when = [formatDate(checkIn), formatDate(checkOut)].filter(Boolean).join(" - ");
  return {
    city: stay.city.trim() || "Stay",
    checkIn,
    checkOut,
    checkInLabel: formatDate(checkIn) || "not set",
    checkOutLabel: formatDate(checkOut) || "not set",
    when: [when, nightCount(checkIn, checkOut), `${hotelLabel}, ${optionLabel}`]
      .filter(Boolean)
      .join(" | "),
    occupancy: occupancy || "Not set",
    hotels,
  };
}

function expandBoardLabel(part: string): string {
  return boardClientLabel(part, true) ?? part.trim();
}

/** Subtitle segments that are cancel tags, not meal plan. */
function isCancelTagPart(part: string): boolean {
  return /^(non[\s-]?refund|free cancel|refundable)\b/i.test(part.trim());
}

function guestsPhrase(adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(adults === 1 ? "1 adult" : `${adults} adults`);
  if (children > 0) {
    parts.push(children === 1 ? "1 child" : `${children} children`);
  }
  return parts.length > 0 ? parts.join(", ") : "guests";
}

function asSegmentString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function asSegmentGuests(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/**
 * Dual-shop merge metadata → client PDF segments (room type + who sleeps there).
 */
function comboSegmentsForQuote(
  raw: Record<string, unknown> | null | undefined,
  season: string | null,
): OptionsQuoteRoomSegment[] | null {
  if (raw?.sabre_multi_occupancy !== true) return null;
  const rows = raw.sabre_occupancy_segments;
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const segments: OptionsQuoteRoomSegment[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const roomName = asSegmentString(rec.room_name) || `Room ${i + 1}`;
    const adults = asSegmentGuests(rec.adults, 1);
    const children = asSegmentGuests(rec.children, 0);
    const guests = guestsPhrase(adults, children);
    const label =
      guests === "guests" ? roomName : `${roomName} (${guests})`;
    const boardRaw = asSegmentString(rec.board);
    const board = boardRaw
      ? expandBoardLabel(boardRaw) || boardRaw
      : "Room only";
    const cancelRaw = asSegmentString(rec.cancellation_summary);
    const payRaw = asSegmentString(rec.payment_summary);
    const maxOcc =
      typeof rec.max_occupancy === "number" && Number.isFinite(rec.max_occupancy)
        ? Math.floor(rec.max_occupancy)
        : adults + children;
    const chips = clientOptionChips({
      roomName,
      cancellation: cancelRaw,
      payment: payRaw,
      maxAdults: maxOcc,
      raw: {
        max_occupancy: maxOcc,
        bed_type: asSegmentString(rec.bed_type),
        payment_timing: asSegmentString(rec.payment_timing),
      },
    });
    segments.push({
      label,
      roomName,
      board,
      chips,
      cancellation: clientRule(cancelRaw, season),
      payment: clientRule(payRaw, season) ?? (payRaw ? payRaw : null),
    });
  }
  return segments.length >= 2 ? segments : null;
}

function comboMealDetail(segments: OptionsQuoteRoomSegment[]): string | null {
  const boards = [
    ...new Set(segments.map((row) => row.board?.trim()).filter(Boolean) as string[]),
  ];
  if (boards.length === 0) return null;
  if (boards.length === 1) return boards[0]!;
  return boards.join(" / ");
}

function roomLine(row: TripRateSnapshot, stay: TripStaySnapshot): OptionsQuoteRoom {
  const currency = row.currency?.trim() || null;
  const raw = row.subtitle?.trim() || row.title.trim();
  const parts = raw.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  const roomName = parts[0] || "Room";
  const rest = parts.slice(1);
  const boardParts = rest
    .filter((part) => !isCancelTagPart(part))
    .map((part) => expandBoardLabel(part))
    .filter(Boolean);
  const season = row.season_code?.trim() || null;
  const segments = comboSegmentsForQuote(row.extracted_raw, season);
  // Joined cancel/payment on a combo is misleading when rooms differ — segments own it.
  const cancellation = segments
    ? null
    : clientRule(row.cancellation_policy, season);
  const payment = segments ? null : clientRule(row.payment_policy, season);
  const comboCancelAgree =
    segments != null &&
    new Set(
      segments.map((segment) => (segment.cancellation ?? "").trim().toLowerCase()),
    ).size === 1;
  const comboPayAgree =
    segments != null &&
    new Set(segments.map((segment) => (segment.payment ?? "").trim().toLowerCase()))
      .size === 1;
  // Combo: occupancy (+ shared cancel/pay only when every room matches).
  const chips = clientOptionChips({
    roomName,
    cancellation: segments
      ? comboCancelAgree
        ? segments[0]?.cancellation
        : null
      : row.cancellation_policy,
    payment: segments
      ? comboPayAgree
        ? segments[0]?.payment
        : null
      : row.payment_policy,
    maxAdults: row.max_adults,
    raw: segments
      ? {
          ...row.extracted_raw,
          // Avoid first-room-only payment_timing when rooms disagree.
          payment_timing: comboPayAgree
            ? row.extracted_raw?.payment_timing
            : null,
        }
      : row.extracted_raw,
  });
  return {
    id: row.id,
    name: roomName,
    chips,
    detail: segments ? comboMealDetail(segments) : boardParts.length > 0 ? boardParts.join(", ") : null,
    price: row.sell_amount == null ? "To be confirmed" : formatAmount(row.sell_amount),
    currency,
    sleeps: segments ? null : sleepsLabel(row.max_adults, row.max_children),
    party: optionPartyLabel(row, stay),
    segments,
    inclusions: clientInclusions(row.inclusions),
    cancellation,
    payment,
    terms: null,
    note: clientNote(row.rate_note),
    contractId: row.contract_id,
    season,
    extras: [],
  };
}

function mealDisplaySuffix(row: TripRateSnapshot | undefined, detail: string | null): string | null {
  const fromDetail = detail?.trim();
  if (fromDetail) return fromDetail.length <= 28 ? fromDetail : `${fromDetail.slice(0, 27).trimEnd()}…`;
  const raw = row?.subtitle?.trim() || "";
  const parts = raw.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  const meal = parts.slice(1).find((part) => !isCancelTagPart(part));
  return meal?.trim() || null;
}

function appendNameSuffix(name: string, suffix: string): string {
  const already = new RegExp(`\\b${escapeRegExp(suffix)}\\b`, "i");
  if (already.test(name)) return name;
  return `${name} – ${suffix}`;
}

/**
 * When two options at one hotel share a room type (two "Twin"), append meal
 * so the PDF can tell them apart. Never put free-cancel / non-refundable on the
 * main title — chips and nested room lines already show that.
 */
function disambiguateDuplicateRoomNames(
  rooms: OptionsQuoteRoom[],
  sourceRows: TripRateSnapshot[],
): OptionsQuoteRoom[] {
  const rowById = new Map(sourceRows.map((row) => [row.id, row]));

  return rooms.map((room) => {
    const dupes = rooms.filter((other) => normRoomKey(other.name) === normRoomKey(room.name));
    if (dupes.length < 2) return room;
    // Combo meal lives in the Meal plan column + nested lines — skip title clutter.
    if (room.segments && room.segments.length >= 2) return room;
    const row = rowById.get(room.id);
    const meal = mealDisplaySuffix(row, room.detail);
    return meal ? { ...room, name: appendNameSuffix(room.name, meal) } : room;
  });
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
  return [
    ...new Set(
      items
        .map((item) => toClientLine(item.trim()))
        .filter((item) => item && !hidden.test(item)),
    ),
  ];
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
