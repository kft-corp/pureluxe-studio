import type {
  RateCompareCard,
  RateCompareHotel,
  RateCompareHotelNotes,
  RateCompareRoom,
  RateCompareRoomSegment,
} from "@pureluxe/ai";
import type { NormalizedRateOption, RateSourceCode } from "@pureluxe/rates";
import { rateMessages, rateSourceLabel } from "@pureluxe/shared";

import { formatRoomMoney, roundMoney } from "@/lib/rates/price-math";

import { guestsPhrase } from "./combo-occupancy-segments";
import type { HotelRateSearchOutcome } from "./search-rates-for-hotels";

const DEFAULT_MARKUPS = [25, 30];
/** Contracted hotels often have many categories — keep the card usable, expand in UI. */
const MAX_ROOMS_PER_HOTEL = 12;
/** Room subtitle chips (Occupancy · Non-refund · Min N) — same for contracted + Sabre. */
const MAX_ROOM_DETAIL_CHIPS = 3;
/** Hotel notes “Included” — short list under the table, not in rows. */
const MAX_NOTE_INCLUSIONS = 4;
/** Footer Payment: labeled deposit lines before “other rooms vary”. */
const MAX_PAYMENT_FOOTER_LINES = 3;

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
  return rateSourceLabel(code);
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

/** Absolute cancel-by date from raw Sabre deadline or "Free cancel until …" text. */
export function parseCancelByDate(
  summary: string | null | undefined,
  raw: Record<string, unknown> | null | undefined,
): string | null {
  const fromRaw = asStringRaw(raw?.cancel_deadline);
  if (fromRaw && /^\d{4}-\d{2}-\d{2}$/.test(fromRaw)) return fromRaw;

  if (!summary?.trim()) return null;
  const iso = summary.match(/\buntil\s+(\d{4}-\d{2}-\d{2})\b/i);
  if (iso?.[1]) return iso[1];

  // "Free cancel until 18 Dec 2026"
  const named = summary.match(
    /\buntil\s+(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i,
  );
  if (named?.[1] && named[2] && named[3]) {
    const months: Record<string, string> = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    const month = months[named[2].slice(0, 3).toLowerCase()];
    if (!month) return null;
    const day = named[1].padStart(2, "0");
    return `${named[3]}-${month}-${day}`;
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

function asStringRaw(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

/**
 * Advisor-facing rate-plan / promo for any Sabre plan string
 * (e.g. "35 PERCENT OFF 2N" → "35% off 2 nights"; other phrases stay readable).
 */
function humanizeRatePlanLabel(value: string): string {
  let text = value.trim().replace(/\s+/g, " ");
  if (!text) return text;
  text = text.replace(/\bPERCENT\b/gi, "%");
  text = text.replace(/(\d)\s+%/g, "$1%");
  text = text.replace(/\b(\d+)\s*N\b/gi, (_, n: string) => {
    const count = Number(n);
    return `${n} night${count === 1 ? "" : "s"}`;
  });
  // Sabre often ships shouty / ALL CAPS plan names — sentence-case for the table.
  const letters = text.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    text = text.toLowerCase();
  }
  text = text.replace(/(\d)\s+%/g, "$1%");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Loyalty-points promos — not useful on advisor rate rows (client trip, not Honors shopping). */
function isLoyaltyPointsOnlyOffer(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  // e.g. "2x points", "earn points", "Honors bonus points"
  if (/\bpoints?\b/i.test(text) || /\bhonors?\b/i.test(text)) {
    // Keep if it also has a commercial cue (breakfast / % off / package).
    if (/breakfast|percent|%|off|purchase|package|include|meal|dinner|lunch/i.test(text)) {
      return false;
    }
    return true;
  }
  return false;
}

/** Hide cryptic Sabre codes (e.g. "Pick") — keep real promos / meal labels. */
function isMeaningfulOfferLabel(value: string): boolean {
  const text = value.trim();
  if (text.length < 4) return false;
  if (/^(pick|rate|std|bar|rak|rac)$/i.test(text)) return false;
  if (isLoyaltyPointsOnlyOffer(text)) return false;
  if (
    /percent|%|off|night|breakfast|purchase|package|member|flex|refund|ap\b|include/i.test(
      text,
    )
  ) {
    return true;
  }
  if (/\s/.test(text) && text.length >= 8) return true;
  return text.length >= 12;
}

/**
 * Legacy mashed labels ("Guest room · 35 PERCENT OFF 2N") → room + offer.
 * Prefer explicit raw.rate_plan_name when present.
 */
function splitRoomAndOffer(
  roomName: string,
  raw: Record<string, unknown> | null | undefined,
): { room: string; offer: string | null } {
  const plan = asStringRaw(raw?.rate_plan_name);
  if (plan && plan.toLowerCase() !== roomName.trim().toLowerCase()) {
    const offer = humanizeRatePlanLabel(plan);
    return {
      room: roomName,
      offer: isMeaningfulOfferLabel(offer) ? offer : null,
    };
  }

  const parts = roomName
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return { room: roomName, offer: null };
  const last = parts[parts.length - 1]!;
  if (/percent|%|\b\d+\s*n\b|\boff\b/i.test(last)) {
    const offer = humanizeRatePlanLabel(last);
    return {
      room: parts.slice(0, -1).join(" · "),
      offer: isMeaningfulOfferLabel(offer) ? offer : null,
    };
  }
  return { room: roomName, offer: null };
}

function cancelFamily(
  summary: string | null | undefined,
): "non_refundable" | "refundable" | "other" | "unknown" {
  const text = summary?.trim().toLowerCase() ?? "";
  if (!text) return "unknown";
  if (/non[\s-]?refundable|no refund|no changes|no credit/.test(text)) {
    return "non_refundable";
  }
  if (/free cancel|fully refundable|refundable|cancel(?:lation)? free/.test(text)) {
    return "refundable";
  }
  return "other";
}

function cancelFamilyLabel(
  family: ReturnType<typeof cancelFamily>,
  summary: string | null,
): string | null {
  if (family === "non_refundable") return "Non-refund";
  if (family === "refundable") {
    // Prefer Sabre "Free cancel until 17 Dec 2026" over bare "Free cancel".
    const until = summary?.match(
      /\buntil\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{4}-\d{2}-\d{2})\b/i,
    );
    if (until?.[1]) return `Free until ${until[1]}`;
    return "Free cancel";
  }
  return null;
}

/** Negation — never treat as included breakfast. */
function deniesBreakfast(text: string): boolean {
  return /\b(?:no|not|without|exclud(?:e|es|ed)|does\s+not\s+include)\b[\s\w/-]{0,28}\bbreakfast\b|\bbreakfast\b[\s\w/-]{0,20}\b(?:not\s+included|excluded|not\s+available)/i.test(
    text,
  );
}

/**
 * Strong positive breakfast cue (meal code / "breakfast included").
 * Matches Sabre mapper standard — no bare /breakfast/ on long blurbs.
 */
function textIndicatesBreakfastIncluded(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const raw = text.trim().replace(/\s+/g, " ");
  if (deniesBreakfast(raw)) return false;
  const compact = raw.replace(/\s+/g, "");
  if (/^(bb|bnb)$/i.test(compact)) return true;
  if (/^bed\s*(?:and|&)\s*breakfast$/i.test(raw)) return true;
  if (/^room\s+with\s+breakfast$/i.test(raw)) return true;
  if (/^breakfast$/i.test(raw)) return true;
  if (/\bbreakfast\s+included\b/i.test(raw)) return true;
  if (/\bincludes?\s+breakfast\b/i.test(raw)) return true;
  if (/\bwith\s+breakfast\b/i.test(raw)) return true;
  if (/\bap\b[\s\w-]{0,24}\bbreakfast\b/i.test(raw)) return true;
  if (raw.length <= 40 && /\bbreakfast\b/i.test(raw)) return true;
  return false;
}

/**
 * Prefer "Room with breakfast" only on strong cues when Sabre left meal plan as RO.
 * Same-price RO + breakfast rows both stay — meal column shows the difference.
 */
function resolveMealPlanBoard(
  option: NormalizedRateOption,
  offerLabel: string | null,
): string | null {
  const board = option.board?.trim() || null;
  // Mapper may already have set "Room with breakfast".
  if (board && /^room\s+with\s+breakfast$/i.test(board)) {
    return "Room with breakfast";
  }
  const plan = asStringRaw(option.raw?.rate_plan_name);
  const hasBreakfast =
    textIndicatesBreakfastIncluded(board) ||
    textIndicatesBreakfastIncluded(offerLabel) ||
    textIndicatesBreakfastIncluded(plan) ||
    (option.inclusions ?? []).some((line) => textIndicatesBreakfastIncluded(line));
  const isRoomOnly =
    !board || /^(ro|room\s*only)$/i.test(board.replace(/\s+/g, " "));

  if (hasBreakfast && (isRoomOnly || textIndicatesBreakfastIncluded(board))) {
    return "Room with breakfast";
  }
  return board ? shortLine(board, 28) : null;
}

/** Min-stay inclusions → short chip; drop breakfast (meal column owns it). */
function shortenInclusionChip(line: string): string | null {
  if (textIndicatesBreakfastIncluded(line) || /breakfast/i.test(line)) return null;
  const min =
    line.match(/minimum\s+(?:of\s+)?(\d+)\s+nights?/i) ??
    line.match(/min(?:imum)?\s*(\d+)\s*nights?/i);
  if (min?.[1]) return `Min ${min[1]} nights`;
  return shortLine(line, 22);
}

/** Cap and de-dupe detail chips so the Room cell stays scannable. */
function joinDetailChips(parts: Array<string | null | undefined>, max = 3): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    // Drop prepaid if we already say Non-refund (same commercial idea for advisors).
    if (key === "prepaid" && (seen.has("non-refund") || seen.has("non-refundable"))) {
      continue;
    }
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out.length > 0 ? out.join(" · ") : null;
}

function occupancyFromDetail(detail: string | null | undefined): string {
  const multi = detail?.match(/occupancy\s+(\d+(?:\s*\/\s*\d+)+)/i);
  if (multi?.[1]) return multi[1].replace(/\s+/g, "");
  const match = detail?.match(/occupancy\s+(\d+)/i);
  return match?.[1] ?? "";
}

type PaymentTiming =
  | "prepaid"
  | "deposit"
  | "guarantee"
  | "pay_at_hotel"
  | "unknown";

function paymentTimingLabel(timing: PaymentTiming): string | null {
  if (timing === "prepaid") return "Prepaid";
  if (timing === "deposit") return "Deposit";
  if (timing === "guarantee") return "Guarantee";
  if (timing === "pay_at_hotel") return "Pay at hotel";
  return null;
}

/** Prefer raw.payment_timing; fall back to payment summary text (all sources). */
function paymentTimingFromOption(option: NormalizedRateOption): PaymentTiming {
  const rawTiming = option.raw?.payment_timing;
  if (
    rawTiming === "prepaid" ||
    rawTiming === "deposit" ||
    rawTiming === "guarantee" ||
    rawTiming === "pay_at_hotel"
  ) {
    return rawTiming;
  }
  if (option.raw?.advance_purchase === true || option.raw?.prepaid === true) {
    return "prepaid";
  }
  const summary = (option.payment_summary ?? "").toLowerCase();
  if (!summary) return "unknown";
  if (/deposit/.test(summary) && !/no\s+deposit/.test(summary)) return "deposit";
  if (/guarantee/.test(summary)) return "guarantee";
  if (/prepaid|pay\s*in\s*advance|full\s*payment\s*in\s*advance/.test(summary)) {
    return "prepaid";
  }
  if (
    /pay\s*at\s*(the\s*)?hotel|pay\s*at\s*property|settled\s*at\s*(the\s*)?hotel|postpaid|pay\s*later/.test(
      summary,
    )
  ) {
    return "pay_at_hotel";
  }
  return "unknown";
}

function paymentTimingFromRoom(room: RateCompareRoom): PaymentTiming {
  const detail = room.detail?.toLowerCase() ?? "";
  if (/\bpay at hotel\b/.test(detail)) return "pay_at_hotel";
  if (/\bprepaid\b/.test(detail)) return "prepaid";
  if (/\bdeposit\b/.test(detail)) return "deposit";
  if (/\bguarantee\b/.test(detail)) return "guarantee";
  const summary = (room.payment ?? "").toLowerCase();
  if (/deposit/.test(summary) && !/no\s+deposit/.test(summary)) return "deposit";
  if (/guarantee/.test(summary)) return "guarantee";
  if (/prepaid|pay\s*in\s*advance/.test(summary)) return "prepaid";
  if (/pay\s*at\s*(the\s*)?hotel|pay\s*at\s*property|postpaid/.test(summary)) {
    return "pay_at_hotel";
  }
  return "unknown";
}

/**
 * Display product identity — room + meal + cancel + occupancy + payment timing.
 * Price is NOT part of the key: identical-looking Twins at different GDS prices
 * collapse to the cheapest (curated advisor table).
 */
function displayProductKey(room: RateCompareRoom): string {
  return [
    room.room_name.trim().toLowerCase(),
    (room.board ?? "").trim().toLowerCase(),
    cancelFamily(room.cancel),
    occupancyFromDetail(room.detail),
    paymentTimingFromRoom(room),
    (room.package_label ?? "").trim().toLowerCase(),
    room.rate_basis ?? "",
  ].join("|");
}

function preferCheaperDisplayTwin(
  a: RateCompareRoom,
  b: RateCompareRoom,
): RateCompareRoom {
  if (a.team_cost !== b.team_cost) {
    return a.team_cost <= b.team_cost ? a : b;
  }
  if (a.recommended !== b.recommended) return a.recommended ? a : b;
  return a;
}

/** Keep one row per display product — cheapest wins (contracted + Sabre). */
function collapseDisplayTwinRooms(rooms: RateCompareRoom[]): RateCompareRoom[] {
  const byFp = new Map<string, RateCompareRoom>();
  for (const room of rooms) {
    const fp = displayProductKey(room);
    const existing = byFp.get(fp);
    if (!existing) {
      byFp.set(fp, room);
      continue;
    }
    byFp.set(fp, preferCheaperDisplayTwin(existing, room));
  }
  return sortRooms([...byFp.values()]);
}

/**
 * When two+ rows share a room name, ensure cancel / payment contrast is visible.
 * Never dump inclusions / promos into the Room cell (meal column + notes own those).
 */
function annotateSimilarRoomDiffs(rooms: RateCompareRoom[]): RateCompareRoom[] {
  const byName = new Map<string, RateCompareRoom[]>();
  for (const room of rooms) {
    const key = room.room_name.trim().toLowerCase();
    const list = byName.get(key) ?? [];
    list.push(room);
    byName.set(key, list);
  }

  return rooms.map((room) => {
    const peers = byName.get(room.room_name.trim().toLowerCase()) ?? [];
    if (peers.length < 2) return room;

    const detailLower = room.detail?.toLowerCase() ?? "";
    const bits: string[] = [];
    const cancelFamilies = new Set(peers.map((peer) => cancelFamily(peer.cancel)));
    if (cancelFamilies.size > 1) {
      const label = cancelFamilyLabel(cancelFamily(room.cancel), room.cancel);
      if (label && !detailLower.includes(label.toLowerCase())) bits.push(label);
    }
    const payTimings = new Set(peers.map((peer) => paymentTimingFromRoom(peer)));
    if (payTimings.size > 1) {
      const label = paymentTimingLabel(paymentTimingFromRoom(room));
      if (label && !detailLower.includes(label.toLowerCase())) bits.push(label);
    }
    if (bits.length === 0) return room;
    return {
      ...room,
      detail: joinDetailChips([room.detail, ...bits], MAX_ROOM_DETAIL_CHIPS),
    };
  });
}

type PartyRoomOccupancy = { adults: number; children: number };

/** Contracted all-in raw: who sleeps in each villa/room. */
function partyRoomsFromRaw(
  raw: Record<string, unknown> | null | undefined,
): PartyRoomOccupancy[] {
  if (!Array.isArray(raw?.party_rooms)) return [];
  const out: PartyRoomOccupancy[] = [];
  for (const row of raw.party_rooms) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const adults = asPositiveNumber(rec.adults);
    if (adults == null || adults < 1) continue;
    out.push({
      adults: Math.floor(adults),
      children: Math.max(0, Math.floor(asPositiveNumber(rec.children) ?? 0)),
    });
  }
  return out;
}

/** Guest counts per physical room for Occupancy 2 / 1 chips. */
function occupancyPerRoomCounts(
  raw: Record<string, unknown> | null | undefined,
): number[] {
  const fromSabre = Array.isArray(raw?.occupancy_per_room)
    ? raw.occupancy_per_room
        .map((n) =>
          typeof n === "number" && Number.isFinite(n) && n >= 1
            ? Math.floor(n)
            : null,
        )
        .filter((n): n is number => n != null)
    : [];
  if (fromSabre.length >= 2) return fromSabre;
  const party = partyRoomsFromRaw(raw);
  if (party.length >= 2) {
    return party.map((room) => room.adults + room.children);
  }
  return [];
}

function occupancyUneven(counts: number[]): boolean {
  if (counts.length < 2) return false;
  return counts.some((n) => n !== counts[0]);
}

/**
 * Compact subtitle under room name — same for contracted + Sabre.
 * Allowed: Occupancy, bed (if not in title), min nights. Cancel added in toRoom.
 */
function roomDetailChipsFromRaw(
  raw: Record<string, unknown> | null | undefined,
  roomName: string,
  inclusions: string[],
  options?: { skipOccupancy?: boolean },
): string[] {
  if (!raw && inclusions.length === 0) return [];
  const parts: string[] = [];
  const bed = asStringRaw(raw?.bed_type);
  const roomLower = roomName.trim().toLowerCase();
  if (
    bed &&
    bed.toLowerCase() !== roomLower &&
    !roomLower.includes(bed.toLowerCase())
  ) {
    parts.push(shortLine(bed, 18) ?? bed);
  }
  if (!options?.skipOccupancy) {
    // Dual-shop / contracted multi-room: guests searched per room (e.g. Occupancy 2 / 1).
    const perRoom = occupancyPerRoomCounts(raw);
    if (
      (raw?.sabre_multi_occupancy === true || perRoom.length >= 2) &&
      perRoom.length >= 2
    ) {
      parts.push(`Occupancy ${perRoom.join(" / ")}`);
    } else {
      const maxOcc =
        asPositiveNumber(raw?.max_occupancy) ?? asPositiveNumber(raw?.max_adults);
      if (maxOcc != null) parts.push(`Occupancy ${maxOcc}`);
    }
  }
  if (raw?.limited_availability === true) {
    parts.push("Limited");
  }
  for (const line of inclusions) {
    const chip = shortenInclusionChip(line);
    if (chip && /^min\s+\d+\s+nights$/i.test(chip)) {
      parts.push(chip);
      break;
    }
  }
  return parts;
}

function normBoardKey(board: string | null | undefined): string {
  const text = (board ?? "room only").trim().toLowerCase().replace(/\s+/g, " ");
  if (/^(ro|room\s*only)$/i.test(text)) return "room only";
  if (/room\s+with\s+breakfast|breakfast/i.test(text)) return "breakfast";
  return text;
}

function segmentBoardLabel(board: string | null | undefined): string | null {
  const text = board?.trim();
  if (!text) return "Room only";
  if (/^(ro|room\s*only)$/i.test(text)) return "Room only";
  if (/room\s+with\s+breakfast/i.test(text)) return "Room with breakfast";
  return shortLine(text, 28);
}

/**
 * Build Room 1 / Room 2 stacks from Sabre dual-shop merge metadata.
 */
function comboSegmentsFromRaw(
  raw: Record<string, unknown> | null | undefined,
  nights: number | null,
): { segments: RateCompareRoomSegment[]; termsDiffer: boolean } | null {
  if (raw?.sabre_multi_occupancy !== true) return null;
  const rows = raw.sabre_occupancy_segments;
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const nightCount = nights != null && nights > 0 ? nights : 1;
  const segments: RateCompareRoomSegment[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const adults = asPositiveNumber(rec.adults) ?? 1;
    const children = Math.max(0, asPositiveNumber(rec.children) ?? 0);
    const guests =
      asPositiveNumber(rec.guests) ?? adults + children;
    const roomName =
      asStringRaw(rec.room_name)?.trim() || `Room ${i + 1}`;
    const board = segmentBoardLabel(asStringRaw(rec.board));
    const cancelBit = cancelFamilyLabel(
      cancelFamily(asStringRaw(rec.cancellation_summary)),
      asStringRaw(rec.cancellation_summary),
    );
    const payBit = paymentTimingLabel(
      paymentTimingFromRaw(rec.payment_timing ?? rec.payment_summary),
    );
    const maxOcc = asPositiveNumber(rec.max_occupancy);
    const bed = asStringRaw(rec.bed_type);
    const detail = joinDetailChips(
      [
        maxOcc != null ? `Occupancy ${maxOcc}` : `Occupancy ${guests}`,
        bed &&
        bed.toLowerCase() !== roomName.toLowerCase() &&
        !roomName.toLowerCase().includes(bed.toLowerCase())
          ? shortLine(bed, 18)
          : null,
        cancelBit,
        payBit,
      ],
      4,
    );
    const teamCost = asPositiveNumber(rec.cost_internal);
    segments.push({
      label: `Room ${i + 1} · ${guestsPhrase(adults, children)}`,
      room_name: roomName,
      adults,
      children,
      guests,
      board,
      detail,
      team_cost: teamCost,
      team_per_night:
        teamCost != null ? roundMoney(teamCost / nightCount) : null,
    });
  }

  if (segments.length < 2) return null;

  const boardKeys = new Set(segments.map((s) => normBoardKey(s.board)));
  const cancelKeys = new Set(
    segments.map((s) => {
      const match = s.detail?.match(/\b(Non-refund|Free cancel)\b/i);
      return (match?.[1] ?? "unknown").toLowerCase();
    }),
  );
  const payKeys = new Set(
    segments.map((s) => {
      const match = s.detail?.match(
        /\b(Deposit|Guarantee|Prepaid|Pay at hotel)\b/i,
      );
      return (match?.[1] ?? "unknown").toLowerCase();
    }),
  );
  const termsDiffer =
    boardKeys.size > 1 || cancelKeys.size > 1 || payKeys.size > 1;

  return { segments, termsDiffer };
}

/**
 * Contracted multi-room with uneven guests: stack Room 1 / Room 2 occupancy
 * (same category × N — no mix-and-match costs per segment).
 */
function contractedSegmentsFromRaw(
  raw: Record<string, unknown> | null | undefined,
  board: string | null,
): { segments: RateCompareRoomSegment[]; termsDiffer: boolean } | null {
  const party = partyRoomsFromRaw(raw);
  if (party.length < 2) return null;
  const counts = party.map((room) => room.adults + room.children);
  if (!occupancyUneven(counts)) return null;

  const maxOcc =
    asPositiveNumber(raw?.max_occupancy) ?? asPositiveNumber(raw?.max_adults);
  const segments: RateCompareRoomSegment[] = party.map((room, index) => {
    const guests = room.adults + room.children;
    const detail = joinDetailChips(
      [maxOcc != null ? `Occupancy ${maxOcc}` : `Occupancy ${guests}`],
      2,
    );
    return {
      label: `Room ${index + 1} · ${guestsPhrase(room.adults, room.children)}`,
      // Same category both rooms — omit name so the stack stays occupancy-only.
      room_name: "",
      adults: room.adults,
      children: room.children,
      guests,
      board,
      detail,
      team_cost: null,
      team_per_night: null,
    };
  });

  return { segments, termsDiffer: false };
}

/** Nightly contracted: sheet for the search (villa × rooms), not stay÷nights. */
function contractedSheetPerNight(
  raw: Record<string, unknown> | null | undefined,
  rooms: number,
  nights: number,
  teamCost: number,
): number {
  const rateBasis = asRateBasis(raw);
  if (rateBasis === "package") {
    return roundMoney(teamCost / Math.max(1, nights));
  }
  const roomCount =
    asPositiveNumber(raw?.rooms) ?? (rooms > 0 ? rooms : null) ?? 1;
  const villaNight = asPositiveNumber(raw?.package_amount);
  if (villaNight != null && roomCount >= 1) {
    return roundMoney(villaNight * roomCount);
  }
  const roomCost = asPositiveNumber(raw?.room_cost);
  if (roomCost != null && nights > 0) {
    return roundMoney(roomCost / nights);
  }
  return roundMoney(teamCost / Math.max(1, nights));
}

function paymentTimingFromRaw(value: unknown): PaymentTiming {
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key === "pay_at_hotel" || key === "pay at hotel") return "pay_at_hotel";
    if (key === "prepaid") return "prepaid";
    if (key === "deposit") return "deposit";
    if (key === "guarantee") return "guarantee";
    if (/pay at hotel|pay later/i.test(key)) return "pay_at_hotel";
    if (/prepaid|pre[\s-]?pay/i.test(key)) return "prepaid";
    if (/deposit/i.test(key)) return "deposit";
    if (/guarantee/i.test(key)) return "guarantee";
  }
  return "unknown";
}

/** Hotel line under the table: check-in/out · stars · city — no amenity dump. */
function hotelHighlightsFromOptions(
  options: NormalizedRateOption[],
): string[] {
  const raw =
    options.find((row) => {
      const r = row.raw;
      return (
        Boolean(asStringRaw(r?.hotel_check_in_time)) ||
        Boolean(asStringRaw(r?.hotel_check_out_time)) ||
        Boolean(asStringRaw(r?.hotel_rating)) ||
        Boolean(asStringRaw(r?.hotel_city))
      );
    })?.raw ??
    options[0]?.raw ??
    null;
  if (!raw) return [];
  const out: string[] = [];
  const checkInTime = asStringRaw(raw.hotel_check_in_time);
  const checkOutTime = asStringRaw(raw.hotel_check_out_time);
  if (checkInTime && checkOutTime) {
    out.push(`Check-in ${checkInTime} · Check-out ${checkOutTime}`);
  } else if (checkInTime) {
    out.push(`Check-in ${checkInTime}`);
  } else if (checkOutTime) {
    out.push(`Check-out ${checkOutTime}`);
  }
  const rating = asStringRaw(raw.hotel_rating);
  if (rating) {
    out.push(/★/.test(rating) ? rating : `${rating}★`);
  }
  const quality = asStringRaw(raw.hotel_quality);
  if (quality) out.push(shortLine(quality, 20) ?? quality);
  const city = asStringRaw(raw.hotel_city);
  if (city) out.push(city);
  if (raw.tax_inclusive === true) out.push("Tax incl.");
  return out.slice(0, 5);
}

function toRoom(
  option: NormalizedRateOption,
  rateRef: string,
  rooms: number,
  nights: number | null,
  checkIn: string,
  markupButtons: number[],
): RateCompareRoom {
  const teamCost = option.cost_internal;
  const nightCount = nights != null && nights > 0 ? nights : 1;
  const cancelByAbsolute = parseCancelByDate(
    option.cancellation_summary,
    option.raw,
  );
  const cancel = shortLine(option.cancellation_summary, 140);
  const cancelDaysFromText = parseCancelDays(option.cancellation_summary);
  const cancelBy =
    cancelByAbsolute ??
    (cancelDaysFromText != null ? addDaysIso(checkIn, -cancelDaysFromText) : null);
  const cancelDays =
    cancelDaysFromText ??
    (cancelByAbsolute && checkIn
      ? nightsBetween(cancelByAbsolute, checkIn)
      : null);
  const inclusions = (option.inclusions ?? [])
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_NOTE_INCLUSIONS);
  const rateBasis = asRateBasis(option.raw);
  const packageNights = asPositiveNumber(option.raw?.package_nights);
  const extraNightTeam = asPositiveNumber(option.raw?.extra_night_amount);
  const extraNightsCount =
    rateBasis === "package" &&
    packageNights != null &&
    nights != null &&
    nights > packageNights
      ? nights - packageNights
      : rateBasis === "package"
        ? 0
        : null;
  const packageAmount = asPositiveNumber(option.raw?.package_amount);
  const packageTeam =
    rateBasis !== "package"
      ? null
      : packageAmount != null
        ? packageAmount
        : extraNightsCount != null &&
            extraNightsCount > 0 &&
            extraNightTeam != null
          ? roundMoney(teamCost - extraNightsCount * extraNightTeam)
          : teamCost;

  const rawName =
    option.room_name?.trim() || option.property_name?.trim() || "Room";
  const { room: roomName, offer: offerLabel } = splitRoomAndOffer(
    rawName,
    option.raw,
  );
  const board = resolveMealPlanBoard(option, offerLabel);
  // Table standard: only package sheet labels under the name (not GDS promo chips).
  const packageLabelOut =
    rateBasis === "package" ? packageLabel(packageNights, nights) : null;

  const family = cancelFamily(option.cancellation_summary);
  let cancelBit: string | null = null;
  if (family === "non_refundable") {
    cancelBit = cancelFamilyLabel(family, option.cancellation_summary);
  } else if (family === "refundable") {
    cancelBit = cancelByAbsolute
      ? `Free until ${formatDisplayDate(cancelByAbsolute)}`
      : cancelFamilyLabel(family, option.cancellation_summary);
  }
  const payTiming = paymentTimingFromOption(option);
  const payBit = paymentTimingLabel(payTiming);
  const isContracted = option.rate_source_code === "offline_contracted";
  const combo =
    comboSegmentsFromRaw(option.raw, nights) ??
    (isContracted ? contractedSegmentsFromRaw(option.raw, board) : null);
  const termsDiffer = combo?.termsDiffer ?? false;
  const hasSegments = (combo?.segments?.length ?? 0) >= 2;

  // Matching dual-shop: flat Occupancy 2 / 1 · cancel · pay.
  // Stacked rooms: skip occupancy on the parent — Room 1 / Room 2 carry it.
  // Mismatched Sabre: occupancy only on parent when not stacked with terms.
  const detail = joinDetailChips(
    termsDiffer
      ? roomDetailChipsFromRaw(option.raw, roomName, inclusions, {
          skipOccupancy: hasSegments,
        })
      : [
          ...roomDetailChipsFromRaw(option.raw, roomName, inclusions, {
            skipOccupancy: hasSegments,
          }),
          cancelBit,
          payBit,
        ],
    MAX_ROOM_DETAIL_CHIPS,
  );

  const boardOut =
    termsDiffer && combo
      ? combo.segments.map((s) => s.board ?? "Room only").join(" / ")
      : board;

  const teamPerNight = isContracted
    ? contractedSheetPerNight(option.raw, rooms, nightCount, teamCost)
    : roundMoney(teamCost / nightCount);

  return {
    rate_ref: rateRef,
    room_name: roomName,
    team_cost: teamCost,
    // Client columns stay empty until the advisor picks a markup (buttons only).
    client_total: null,
    client_per_night: null,
    team_per_night: teamPerNight,
    currency: option.currency,
    pricing_scope: pricingScope(option.raw),
    rooms,
    board: boardOut,
    detail,
    // Keep full deposit amounts for notes / follow-ups (footer truncating cut JPY lines).
    payment: option.payment_summary?.trim() || null,
    source: sourceLabel(option.rate_source_code),
    rate_basis: rateBasis,
    package_nights: rateBasis === "package" ? packageNights : null,
    package_team: packageTeam,
    extra_nights_count: extraNightsCount,
    extra_night_team: rateBasis === "package" ? extraNightTeam : null,
    extra_night_client: null,
    package_label: packageLabelOut,
    cancel,
    cancel_by: cancelBy,
    cancel_days: cancelDays,
    inclusions,
    markup_percent: null,
    recommended: Boolean(option.recommended),
    markup_buttons: markupButtons,
    segments: combo?.segments ?? null,
    terms_differ: termsDiffer,
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

/** Cancel chips already live on room / Room 1–2 rows — skip footer duplicate. */
function tableShowsCancel(rooms: RateCompareRoom[]): boolean {
  const chip = /\b(non-refund|free cancel|refundable)\b/i;
  return rooms.some((room) => {
    if (cancelFamily(room.cancel) !== "unknown") return true;
    if (chip.test(room.detail ?? "")) return true;
    return (room.segments ?? []).some((segment) => chip.test(segment.detail ?? ""));
  });
}

/** Deposit / guarantee chips already on rows — timing-only footer is redundant. */
function tableShowsPaymentTiming(rooms: RateCompareRoom[]): boolean {
  const chip = /\b(deposit|guarantee|prepaid|pay at hotel)\b/i;
  return rooms.some((room) => {
    if (paymentTimingFromRoom(room) !== "unknown") return true;
    if (chip.test(room.detail ?? "")) return true;
    return (room.segments ?? []).some((segment) => chip.test(segment.detail ?? ""));
  });
}

function isMultiOccupancyOptions(options: NormalizedRateOption[]): boolean {
  return options.some((option) => option.raw?.sabre_multi_occupancy === true);
}

/** Room size / bed blurbs are not rate policy — hide from Rate terms. */
function isRelevantRateTerm(term: string): boolean {
  const text = term.trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  if (
    /\b\d+(\.\d+)?\s*(-|–|to)\s*\d+(\.\d+)?\s*(sq\.?\s*m|sqm|m²|sq\.?\s*ft|square)\b/i.test(
      text,
    ) ||
    /^\d+(\.\d+)?\s*(-|–)\s*\d+(\.\d+)?\s*sq\b/i.test(text) ||
    /\b\d+\s*(sq\.?\s*m|sqm|m²|sq\.?\s*ft)\b/i.test(text)
  ) {
    return false;
  }
  if (
    /bedroom|floor\b|city view|ocean view|garden view/i.test(lower) &&
    !/night|cancel|payment|deposit|advance|prepaid|min\b/i.test(lower)
  ) {
    return false;
  }
  if (/^min(?:imum)?\s+\d+\s+nights?$/i.test(text)) return true;
  if (
    /\b(min(?:imum)?\s+\d+\s+nights?|advance\s+purchase|paid\s+in\s+advance|full\s+payment|prepaid|non[\s-]?refundable|no\s+changes)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  // Keep short commercial policy blurbs; drop long room copy.
  return text.length <= 80 && !/\b(amenities|wifi|internet|bathtub)\b/i.test(lower);
}

function paymentHasAmount(line: string): boolean {
  return /\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|INR|SGD|AED|THB|HKD|NZD)\b|\d{2,}/i.test(
    line,
  );
}

/** Advisor label for a dual-shop segment — room type + who sleeps there (not Room 1/2). */
function segmentPaymentLabel(rec: Record<string, unknown>, index: number): string {
  const roomName = asStringRaw(rec.room_name)?.trim() || `Room ${index + 1}`;
  const adults = asPositiveNumber(rec.adults) ?? 0;
  const children = Math.max(0, asPositiveNumber(rec.children) ?? 0);
  const guests = guestsPhrase(adults, children);
  if (guests === "guests") return roomName;
  return `${roomName} (${guests})`;
}

/** Season codes on contracted raw (e.g. peak) — filter multi-season payment blurbs. */
function seasonCodesFromOptions(options: NormalizedRateOption[]): string[] {
  for (const option of options) {
    const codes = option.raw?.season_codes;
    if (!Array.isArray(codes)) continue;
    const out = codes
      .filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
      .map((c) => c.trim().toLowerCase());
    if (out.length > 0) return out;
  }
  return [];
}

/**
 * "Peak: … High: … Low: …" → keep only seasons on this search.
 * Unchanged when the line has no season labels or no matching season codes.
 */
function filterPaymentBySeason(
  payment: string,
  seasonCodes: string[],
): string {
  if (seasonCodes.length === 0) return payment;
  const parts = payment
    .split(/(?=\b(?:Peak|High|Low|Shoulder)\s*:)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return payment;
  const wanted = new Set(seasonCodes.map((c) => c.toLowerCase()));
  const alias: Record<string, string> = {
    peak: "peak",
    high: "high",
    low: "low",
    shoulder: "shoulder",
  };
  const kept = parts.filter((part) => {
    const match = part.match(/^(Peak|High|Low|Shoulder)\s*:/i);
    if (!match?.[1]) return true;
    const key = alias[match[1].toLowerCase()];
    return key != null && wanted.has(key);
  });
  return kept.length > 0 ? kept.join(" ") : payment;
}

/** Twin · Non-refund · Breakfast — disambiguate same room name in the payment footer. */
function roomPaymentFooterLabel(
  room: RateCompareRoom,
  peers: RateCompareRoom[],
): string {
  const name = room.room_name.trim() || "Room";
  const cancel = cancelFamilyLabel(cancelFamily(room.cancel), room.cancel);
  const nameKey = name.toLowerCase();
  const sameName = peers.filter(
    (peer) => peer.room_name.trim().toLowerCase() === nameKey,
  );
  const boardKeys = new Set(
    sameName.map((peer) => (peer.board ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const needBoard = sameName.length > 1 && boardKeys.size > 1;
  const boardBit =
    needBoard && room.board?.trim()
      ? shortLine(room.board.trim(), 22) ?? room.board.trim()
      : null;
  return [name, cancel, boardBit].filter(Boolean).join(" · ");
}

function formatLabeledPaymentFooter(
  labeled: Array<{ label: string; pay: string }>,
): string | null {
  if (labeled.length === 0) return null;
  const amounts = labeled.some((row) => paymentHasAmount(row.pay));
  if (!amounts) return null;
  const uniquePays = new Set(labeled.map((row) => row.pay.toLowerCase()));
  if (uniquePays.size === 1) return labeled[0]!.pay;

  const byPay = new Map<string, { label: string; pay: string }>();
  for (const row of labeled) {
    const key = row.pay.toLowerCase();
    if (!byPay.has(key)) byPay.set(key, row);
  }
  const distinct = [...byPay.values()];
  const shown = distinct.slice(0, MAX_PAYMENT_FOOTER_LINES);
  const body = shown.map((row) => `${row.label}: ${row.pay}`).join(" · ");
  if (distinct.length > MAX_PAYMENT_FOOTER_LINES) {
    return `${body}. ${rateMessages.hint.paymentVariesAskRoom}`;
  }
  return body;
}

/**
 * Footer payment: room-wise deposit amounts when useful; hide timing-only
 * duplicates already on the table; never truncate amounts mid-string.
 * Differing amounts are labeled (Twin · Non-refund: …) and capped.
 */
function paymentNoteFromOptions(
  rooms: RateCompareRoom[],
  options: NormalizedRateOption[],
): string | null {
  const multiRaw = options.find((option) => option.raw?.sabre_multi_occupancy === true)
    ?.raw;
  const segmentRows = Array.isArray(multiRaw?.sabre_occupancy_segments)
    ? (multiRaw!.sabre_occupancy_segments as unknown[])
    : null;
  const seasons = seasonCodesFromOptions(options);

  if (segmentRows && segmentRows.length >= 2) {
    const labeled: Array<{ label: string; pay: string }> = [];
    for (let i = 0; i < segmentRows.length; i += 1) {
      const row = segmentRows[i];
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const pay = asStringRaw(rec.payment_summary)?.trim();
      if (!pay) continue;
      labeled.push({
        label: segmentPaymentLabel(rec, i),
        pay: filterPaymentBySeason(pay, seasons),
      });
    }
    if (labeled.length === 0) return null;
    const amounts = labeled.some((row) => paymentHasAmount(row.pay));
    if (!amounts && tableShowsPaymentTiming(rooms)) return null;
    return formatLabeledPaymentFooter(labeled);
  }

  // Prefer compare rooms (collapsed + sorted) so labels match the table.
  const fromRooms = rooms
    .map((room) => {
      const rawPay = room.payment?.trim();
      if (!rawPay) return null;
      const pay = filterPaymentBySeason(rawPay, seasons);
      if (!pay) return null;
      return {
        label: roomPaymentFooterLabel(room, rooms),
        pay,
        recommended: room.recommended,
        team_cost: room.team_cost,
      };
    })
    .filter(
      (row): row is {
        label: string;
        pay: string;
        recommended: boolean;
        team_cost: number;
      } => row != null,
    )
    .sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
      return a.team_cost - b.team_cost;
    });

  if (fromRooms.length > 0) {
    const amounts = fromRooms.some((row) => paymentHasAmount(row.pay));
    if (!amounts && tableShowsPaymentTiming(rooms)) return null;
    return formatLabeledPaymentFooter(
      fromRooms.map((row) => ({ label: row.label, pay: row.pay })),
    );
  }

  // Fallback when rooms lack payment but options still have summaries.
  const lines = options
    .map((option) => option.payment_summary?.trim() || null)
    .filter((line): line is string => Boolean(line))
    .map((line) => filterPaymentBySeason(line, seasons));
  if (lines.length === 0) return null;
  const unique = [...new Set(lines)];
  const amounts = unique.some((line) => paymentHasAmount(line));
  if (!amounts && tableShowsPaymentTiming(rooms)) return null;
  if (unique.length === 1) return unique[0] ?? null;
  // Unlabeled multi-pay from options only — avoid the old dump.
  return formatLabeledPaymentFooter(
    unique.map((pay, index) => ({
      label: `Rate ${index + 1}`,
      pay,
    })),
  );
}

/** Festive / green tax (and similar) already inside stay cost — footer only. */
function requiredExtrasLineFromOptions(
  options: NormalizedRateOption[],
): string | null {
  const option =
    options.find((row) => {
      const extras = row.raw?.applied_extras;
      return Array.isArray(extras) && extras.length > 0;
    }) ?? null;
  if (!option?.raw || !Array.isArray(option.raw.applied_extras)) return null;

  const bits: string[] = [];
  const seen = new Set<string>();
  for (const item of option.raw.applied_extras) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = asStringRaw(rec.name)?.trim();
    const amount =
      typeof rec.amount === "number" && Number.isFinite(rec.amount)
        ? rec.amount
        : null;
    if (!name || amount == null || amount === 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bits.push(`${name} ${formatRoomMoney(amount, option.currency)}`);
    if (bits.length >= 4) break;
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

function hotelNotes(
  rooms: RateCompareRoom[],
  checkIn: string,
  options: NormalizedRateOption[],
): RateCompareHotelNotes {
  // Cancel is on each room / Room 1–2 line — footer only when the table has none.
  const cancellation = tableShowsCancel(rooms)
    ? null
    : (() => {
        const cancelFamilies = new Set(
          rooms
            .map((room) => cancelFamily(room.cancel))
            .filter((family) => family !== "unknown"),
        );
        const firstWithCancel =
          rooms.find((room) => room.cancel || room.cancel_by) ?? null;
        if (cancelFamilies.size > 1) return "Varies by rate — see each room";
        if (!firstWithCancel) return null;
        return cancelByLine(
          firstWithCancel.cancel,
          firstWithCancel.cancel_by,
          firstWithCancel.cancel_days,
          checkIn,
        );
      })();

  const payment = paymentNoteFromOptions(rooms, options);

  const markupPct = rooms[0]?.markup_percent ?? null;
  const markup =
    markupPct != null ? `Applied markup ${markupPct}% — sell per-night and total use this` : null;

  const seen = new Set<string>();
  const inclusions: string[] = [];
  for (const room of rooms) {
    for (const line of room.inclusions) {
      // Breakfast lives in Meal plan; min-stay lives on the room row when needed.
      const chip = shortenInclusionChip(line);
      if (!chip || /^min\s+\d+\s+nights$/i.test(chip)) continue;
      if (textIndicatesBreakfastIncluded(line)) continue;
      const key = chip.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      inclusions.push(chip);
      if (inclusions.length >= MAX_NOTE_INCLUSIONS) break;
    }
    if (inclusions.length >= MAX_NOTE_INCLUSIONS) break;
  }

  const rateTermsSeen = new Set<string>();
  const rateTerms: string[] = [];
  for (const option of options) {
    const term = asStringRaw(option.raw?.rate_terms);
    if (!term || !isRelevantRateTerm(term)) continue;
    const minChip = shortenInclusionChip(term);
    const shortened =
      minChip && /^min\s+\d+\s+nights$/i.test(minChip)
        ? minChip
        : textIndicatesBreakfastIncluded(term)
          ? null
          : term.trim();
    if (!shortened || !isRelevantRateTerm(shortened)) continue;
    const key = shortened.toLowerCase();
    if (rateTermsSeen.has(key)) continue;
    rateTermsSeen.add(key);
    rateTerms.push(shortened);
    if (rateTerms.length >= 2) break;
  }

  const multi = isMultiOccupancyOptions(options);
  // Dual-shop raw is Room 1–biased — hide stay tax/extras rather than mislabel the stay.
  const inStay = multi ? null : inStayLineFromOptions(options);
  const requiredExtras = requiredExtrasLineFromOptions(options);
  const roomExtras = multi ? null : extrasLineFromOptions(options);
  const extras =
    requiredExtras && roomExtras
      ? `${requiredExtras} · ${roomExtras}`
      : requiredExtras ?? roomExtras;

  const hasContracted = options.some(
    (option) => option.rate_source_code === "offline_contracted",
  );
  const hasNightlyContracted = options.some(
    (option) =>
      option.rate_source_code === "offline_contracted" &&
      asRateBasis(option.raw) !== "package",
  );
  const pricing =
    hasNightlyContracted || (hasContracted && requiredExtras)
      ? rateMessages.hint.contractedPricingSheet
      : null;

  return {
    cancellation,
    payment,
    markup,
    inclusions,
    highlights: hotelHighlightsFromOptions(options),
    rate_terms: rateTerms,
    in_stay: inStay,
    extras,
    pricing,
  };
}

function asStringListRaw(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Tax + fees already inside stay cost — short commercial reference under the table. */
function inStayLineFromOptions(options: NormalizedRateOption[]): string | null {
  const option =
    options.find((row) => {
      const raw = row.raw;
      if (!raw) return false;
      return (
        typeof raw.tax_amount === "number" ||
        asStringListRaw(raw.fee_lines).length > 0 ||
        raw.tax_inclusive === true ||
        raw.fees_inclusive === true ||
        raw.commissionable === true ||
        raw.commissionable === false
      );
    }) ?? null;
  if (!option?.raw) return null;
  const bits: string[] = [];
  if (option.raw.tax_inclusive === true) bits.push("tax incl.");
  if (option.raw.fees_inclusive === true) bits.push("fees incl.");
  if (option.raw.commissionable === true) bits.push("commissionable");
  if (option.raw.commissionable === false) bits.push("non-commissionable");
  const tax =
    typeof option.raw.tax_amount === "number" && Number.isFinite(option.raw.tax_amount)
      ? option.raw.tax_amount
      : null;
  if (tax != null && tax > 0) {
    bits.push(`tax ${formatRoomMoney(tax, option.currency)}`);
  }
  const supplierCurrency = asStringRaw(option.raw.supplier_currency);
  const supplierAmount =
    typeof option.raw.supplier_amount_after_tax === "number" &&
    Number.isFinite(option.raw.supplier_amount_after_tax)
      ? option.raw.supplier_amount_after_tax
      : null;
  if (supplierCurrency && supplierAmount != null && supplierCurrency !== option.currency) {
    bits.push(
      `hotel currency ${formatRoomMoney(supplierAmount, supplierCurrency)}`,
    );
  }
  for (const fee of asStringListRaw(option.raw.fee_lines).slice(0, 2)) {
    bits.push(shortLine(fee, 40) ?? fee);
  }
  return bits.length > 0 ? bits.join(" · ") : null;
}

/** Room extras for party planning — prefer paid lines first, then free. */
function extrasLineFromOptions(options: NormalizedRateOption[]): string | null {
  const option =
    options.find((row) => asStringListRaw(row.raw?.room_extra_lines).length > 0) ?? null;
  if (!option?.raw) return null;
  const lines = asStringListRaw(option.raw.room_extra_lines).map((line) =>
    line
      .replace(/:\s*(USD|EUR|GBP|JPY)?\s*0(?:\.0+)?\b/i, ": free")
      .replace(/:\s*free of cost\b/i, ": free"),
  );
  if (lines.length === 0) return null;
  const isFree = (line: string) => /:\s*free\b/i.test(line);
  const paid = lines.filter((line) => !isFree(line));
  const free = lines.filter((line) => isFree(line));
  const picked = [...paid, ...free].slice(0, 3);
  return picked.length > 0 ? picked.join(" · ") : null;
}

function hotelRow(
  outcome: HotelRateSearchOutcome,
  rooms: number,
  nights: number | null,
  checkIn: string,
): RateCompareHotel {
  // Suggested markup buttons only — do not seed client totals from hotel commission.
  const markups = DEFAULT_MARKUPS;

  if (outcome.status !== "ok") {
    return {
      hotel: outcome.hotel,
      status: outcome.status,
      from_cost: null,
      currency: null,
      source: null,
      recommended: false,
      rooms: [],
      notes: {
        cancellation: null,
        payment: null,
        markup: null,
        inclusions: [],
        highlights: [],
        rate_terms: [],
        in_stay: null,
        extras: null,
        pricing: null,
      },
      suggest_to_client: null,
      note: outcome.note,
      alternatives: outcome.alternatives,
    };
  }

  const compareRooms = annotateSimilarRoomDiffs(
    collapseDisplayTwinRooms(
      sortRooms(
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
      ),
    ),
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
    notes: hotelNotes(compareRooms, checkIn, outcome.options),
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
