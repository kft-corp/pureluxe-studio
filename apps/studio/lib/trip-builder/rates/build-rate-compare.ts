import type {
  RateCompareCard,
  RateCompareHotel,
  RateCompareHotelNotes,
  RateCompareRoom,
} from "@pureluxe/ai";
import type { NormalizedRateOption, RateSourceCode } from "@pureluxe/rates";

import { clientPriceAtMarkup, roundMoney } from "@/lib/rates/price-math";

import type { HotelRateSearchOutcome } from "./search-rates-for-hotels";

const DEFAULT_MARKUPS = [25, 30];
/** Keep the table short — advisor can ask for more rooms. */
const MAX_ROOMS_PER_HOTEL = 5;
const MAX_INCLUSIONS = 6;

const SOURCE_PRIORITY: Record<string, number> = {
  offline_contracted: 0,
  gds_negotiated: 1,
  wholesale: 2,
  ota_bedbank: 3,
  gds_public: 4,
  offline_manual: 5,
};

function pricingScope(raw: Record<string, unknown> | null | undefined): "per_room" | "total" {
  return raw?.pricing_scope === "per_room" ? "per_room" : "total";
}

function sourceLabel(code: RateSourceCode | string | null | undefined): string {
  switch (code) {
    case "offline_contracted":
      return "Contracted";
    case "gds_negotiated":
      return "Sabre negotiated";
    case "gds_public":
      return "Sabre";
    case "ota_bedbank":
      return "Bedbank";
    case "wholesale":
      return "Wholesale";
    case "offline_manual":
      return "Pasted";
    default:
      return "Rate";
  }
}

function shortLine(value: string | null | undefined, max = 48): string | null {
  const text = value?.trim();
  if (!text) return null;
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function nightsBetween(checkIn: string, checkOut: string): number | null {
  const start = Date.parse(`${checkIn}T12:00:00Z`);
  const end = Date.parse(`${checkOut}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.round((end - start) / 86_400_000);
}

/** Parse "30 days" / "within 14 days" style cancel windows from policy text. */
export function parseCancelDays(summary: string | null | undefined): number | null {
  if (!summary?.trim()) return null;
  const patterns = [
    /\b(?:within|before)\s+(\d+)\s*days?\b/i,
    /\b(\d+)\s*-?\s*day(?:s)?\s+(?:cancel|cancellation|free)\b/i,
    /\bcancel(?:lation)?[^\d]{0,20}(\d+)\s*days?\b/i,
    /\b(\d+)\s*days?\s+before\b/i,
  ];
  for (const pattern of patterns) {
    const match = summary.match(pattern);
    if (!match?.[1]) continue;
    const days = Number(match[1]);
    if (Number.isFinite(days) && days >= 0 && days <= 365) return days;
  }
  return null;
}

function addDaysIso(isoDate: string, deltaDays: number): string | null {
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  const next = new Date(ms + deltaDays * 86_400_000);
  return next.toISOString().slice(0, 10);
}

function formatDisplayDate(isoDate: string): string {
  const ms = Date.parse(`${isoDate}T12:00:00Z`);
  if (!Number.isFinite(ms)) return isoDate;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(ms);
}

function cancelByLine(
  cancel: string | null,
  cancelBy: string | null,
  cancelDays: number | null,
  checkIn: string,
): string | null {
  if (cancelBy && cancelDays != null) {
    return `Cancel by ${formatDisplayDate(cancelBy)} (${cancelDays} days before check-in ${formatDisplayDate(checkIn)})`;
  }
  if (cancelBy) return `Cancel by ${formatDisplayDate(cancelBy)}`;
  return cancel;
}

function sourceRank(label: string): number {
  const entry = Object.entries(SOURCE_PRIORITY).find(
    ([code]) => sourceLabel(code as RateSourceCode) === label,
  );
  return entry ? entry[1] : 9;
}

function sortRooms(rooms: RateCompareRoom[]): RateCompareRoom[] {
  return [...rooms].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    const labelDiff = sourceRank(a.source) - sourceRank(b.source);
    if (labelDiff !== 0) return labelDiff;
    return a.team_cost - b.team_cost;
  });
}

function asRateBasis(raw: Record<string, unknown> | null | undefined): "nightly" | "package" | null {
  const value = raw?.rate_basis;
  if (value === "package" || value === "nightly") return value;
  return null;
}

function asPositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value;
}

function packageLabel(
  packageNights: number | null,
  stayNights: number | null,
): string | null {
  if (packageNights == null || packageNights <= 0) return "Package";
  if (stayNights != null && stayNights > packageNights) {
    const extra = stayNights - packageNights;
    return `${packageNights}N + ${extra} extra`;
  }
  return `${packageNights}N package`;
}

function toRoom(
  option: NormalizedRateOption,
  rateRef: string,
  rooms: number,
  nights: number | null,
  checkIn: string,
  markupButtons: number[],
): RateCompareRoom {
  const markup = markupButtons[0] ?? 30;
  const teamCost = option.cost_internal;
  const clientTotal = clientPriceAtMarkup(teamCost, markup);
  const nightCount = nights != null && nights > 0 ? nights : 1;
  const cancel = shortLine(option.cancellation_summary, 80);
  const cancelDays = parseCancelDays(option.cancellation_summary);
  const cancelBy =
    cancelDays != null ? addDaysIso(checkIn, -cancelDays) : null;
  const inclusions = (option.inclusions ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_INCLUSIONS);
  const rateBasis = asRateBasis(option.raw);
  const packageNights = asPositiveNumber(option.raw?.package_nights);
  const extraNightTeam = asPositiveNumber(option.raw?.extra_night_amount);
  const extraNightClient =
    extraNightTeam == null ? null : clientPriceAtMarkup(extraNightTeam, markup);

  return {
    rate_ref: rateRef,
    room_name: option.room_name?.trim() || option.property_name?.trim() || "Room",
    team_cost: teamCost,
    client_total: clientTotal,
    client_per_night: roundMoney(clientTotal / nightCount),
    team_per_night: roundMoney(teamCost / nightCount),
    currency: option.currency,
    pricing_scope: pricingScope(option.raw),
    rooms,
    board: shortLine(option.board, 24),
    source: sourceLabel(option.rate_source_code),
    rate_basis: rateBasis,
    package_nights: rateBasis === "package" ? packageNights : null,
    extra_night_team: rateBasis === "package" ? extraNightTeam : null,
    extra_night_client: rateBasis === "package" ? extraNightClient : null,
    package_label: rateBasis === "package" ? packageLabel(packageNights, nights) : null,
    cancel,
    cancel_by: cancelBy,
    cancel_days: cancelDays,
    inclusions,
    markup_percent: markup,
    recommended: Boolean(option.recommended),
    markup_buttons: markupButtons,
  };
}

function primarySource(rooms: RateCompareRoom[]): string | null {
  if (rooms.length === 0) return null;
  const counts = new Map<string, number>();
  for (const room of rooms) {
    counts.set(room.source, (counts.get(room.source) ?? 0) + 1);
  }
  return (
    [...counts.entries()].sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return sourceRank(a[0]) - sourceRank(b[0]);
    })[0]?.[0] ??
    rooms[0]?.source ??
    null
  );
}

function hotelNotes(rooms: RateCompareRoom[], checkIn: string): RateCompareHotelNotes {
  const firstWithCancel = rooms.find((room) => room.cancel || room.cancel_by) ?? null;
  const cancellation = firstWithCancel
    ? cancelByLine(
        firstWithCancel.cancel,
        firstWithCancel.cancel_by,
        firstWithCancel.cancel_days,
        checkIn,
      )
    : null;

  const markupPct = rooms[0]?.markup_percent ?? null;
  const markup =
    markupPct != null
      ? `Commission rate ${markupPct}% — client per-night and total use this`
      : null;

  const seen = new Set<string>();
  const inclusions: string[] = [];
  for (const room of rooms) {
    for (const line of room.inclusions) {
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      inclusions.push(line);
      if (inclusions.length >= MAX_INCLUSIONS) break;
    }
    if (inclusions.length >= MAX_INCLUSIONS) break;
  }

  return { cancellation, markup, inclusions };
}

function hotelRow(
  outcome: HotelRateSearchOutcome,
  rooms: number,
  nights: number | null,
  checkIn: string,
): RateCompareHotel {
  const markups =
    outcome.min_markup_percent != null && outcome.min_markup_percent > 0
      ? [
          outcome.min_markup_percent,
          ...DEFAULT_MARKUPS.filter((m) => m !== outcome.min_markup_percent),
        ].slice(0, 2)
      : DEFAULT_MARKUPS;

  if (outcome.status !== "ok") {
    return {
      hotel: outcome.hotel,
      status: outcome.status,
      from_cost: null,
      currency: null,
      source: null,
      recommended: false,
      rooms: [],
      notes: { cancellation: null, markup: null, inclusions: [] },
      suggest_to_client: null,
      note: outcome.note,
      alternatives: outcome.alternatives,
    };
  }

  const compareRooms = sortRooms(
    outcome.options
      .map((option, index) =>
        toRoom(
          option,
          outcome.result_ids[index] ?? outcome.result_ids[0] ?? "",
          rooms,
          nights,
          checkIn,
          markups,
        ),
      )
      .filter((room) => room.rate_ref),
  ).slice(0, MAX_ROOMS_PER_HOTEL);

  const costs = compareRooms.map((room) => room.team_cost);
  return {
    hotel: outcome.hotel,
    status: "ok",
    from_cost: costs.length > 0 ? Math.min(...costs) : null,
    currency: compareRooms[0]?.currency ?? null,
    source: primarySource(compareRooms),
    recommended: false,
    rooms: compareRooms,
    notes: hotelNotes(compareRooms, checkIn),
    suggest_to_client: null,
    note: null,
    alternatives: [],
  };
}

/** Primary + optional next-cheapest value room for the client. */
function hotelSuggestLine(hotel: RateCompareHotel): string | null {
  if (hotel.rooms.length === 0) return null;
  const primary =
    hotel.rooms.find((room) => room.recommended) ??
    [...hotel.rooms].sort((a, b) => a.team_cost - b.team_cost)[0];
  if (!primary) return null;
  const backup = [...hotel.rooms]
    .filter((room) => room.rate_ref !== primary.rate_ref)
    .sort((a, b) => a.team_cost - b.team_cost)[0];
  if (!backup) return `${primary.room_name} (primary)`;
  return `${primary.room_name} (primary) · ${backup.room_name} (value)`;
}

/** One overall pick across hotels for the advisor. */
function cardSuggestLine(
  hotels: RateCompareHotel[],
  preference: string | null,
): string | null {
  const best =
    hotels.find((hotel) => hotel.recommended && hotel.rooms.length > 0) ??
    hotels.find((hotel) => hotel.status === "ok" && hotel.rooms.length > 0) ??
    null;
  if (!best) return null;
  const room =
    best.rooms.find((row) => row.recommended) ??
    [...best.rooms].sort((a, b) => a.team_cost - b.team_cost)[0];
  if (!room) return null;
  const prefHint = preference?.trim() ? " · matches client preference" : "";
  return `${best.hotel} · ${room.room_name}${prefHint}`;
}

function withSuggestLines(
  hotels: RateCompareHotel[],
  preference: string | null,
): { hotels: RateCompareHotel[]; suggest_to_client: string | null } {
  const withHotelSuggest = hotels.map((hotel) => ({
    ...hotel,
    suggest_to_client: hotelSuggestLine(hotel),
  }));
  return {
    hotels: withHotelSuggest,
    suggest_to_client: cardSuggestLine(withHotelSuggest, preference),
  };
}

/** Pick one best room (and its hotel) when the adapters did not mark any. */
function applyRecommended(hotels: RateCompareHotel[]): RateCompareHotel[] {
  const already = hotels.some((hotel) => hotel.rooms.some((room) => room.recommended));
  if (already) {
    return hotels.map((hotel) => ({
      ...hotel,
      recommended: hotel.rooms.some((room) => room.recommended),
      rooms: sortRooms(hotel.rooms),
    }));
  }

  let bestHotel = -1;
  let bestRoom = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let hotelIndex = 0; hotelIndex < hotels.length; hotelIndex++) {
    const hotel = hotels[hotelIndex]!;
    for (let roomIndex = 0; roomIndex < hotel.rooms.length; roomIndex++) {
      const room = hotel.rooms[roomIndex]!;
      const score = sourceRank(room.source) * 1_000_000 + room.team_cost;
      if (score < bestScore) {
        bestHotel = hotelIndex;
        bestRoom = roomIndex;
        bestScore = score;
      }
    }
  }

  if (bestHotel < 0 || bestRoom < 0) return hotels;

  return hotels.map((hotel, hotelIndex) => {
    if (hotelIndex !== bestHotel) return hotel;
    const rooms = hotel.rooms.map((room, roomIndex) =>
      roomIndex === bestRoom ? { ...room, recommended: true } : room,
    );
    return {
      ...hotel,
      recommended: true,
      rooms: sortRooms(rooms),
    };
  });
}

/** Build the rate table the advisor sees under the rates_search reply. */
export function buildRateCompare(input: {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
  hotels: HotelRateSearchOutcome[];
  preference: string | null;
  searchedAt?: string | null;
}): RateCompareCard {
  const nights = nightsBetween(input.checkIn, input.checkOut);
  const ranked = applyRecommended(
    input.hotels.map((hotel) => hotelRow(hotel, input.rooms, nights, input.checkIn)),
  );
  const { hotels, suggest_to_client } = withSuggestLines(ranked, input.preference);
  return {
    destination: input.destination,
    check_in: input.checkIn,
    check_out: input.checkOut,
    adults: input.adults,
    children: input.children,
    rooms: input.rooms,
    nights,
    searched_at: input.searchedAt ?? null,
    shared_terms: [],
    preference: input.preference,
    suggest_to_client,
    hotels,
  };
}
