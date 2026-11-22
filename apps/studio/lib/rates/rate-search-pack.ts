import type { NormalizedRateOption } from "@pureluxe/rates";

import { formatRoomMoney } from "./price-math";

/**
 * A question about the hotel, the rooms, or the rules on the last search.
 * A request to search again is not one.
 */
export function questionUsesRatePack(message: string): boolean {
  if (
    /\b(?:search|find|check|get|look up)\b[\s\S]{0,40}\b(?:rates?|prices?)\b/i.test(message)
  ) {
    return false;
  }
  const text = message.trim();
  if (/\?/.test(text)) return true;
  if (
    /^(?:who|what|when|where|why|how|which|is|are|do|does|did|can|could|tell me|about)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return /\b(?:rates?|prices?|costs?|rooms?|villas?|hotels?|stay|inclusions?|included|includes|cancel(?:lation)?|payment|offers?|markup|transfers?|seaplane|check-?in|check-?out|kids?|children|child|adults?|guests?|occupancy|honeymoons?|anniversar(?:y|ies)|groups?|stop sale|board|breakfast|lunch|dinner|tax|fees?|charges?|amenit\w*|pool|wifi|parking|supplement|extras?|rollaway|crib|benefits?|policy|policies|package|nights?|booking code|complimentary|combinable)\b/i.test(
    text,
  );
}

function rawNumber(raw: Record<string, unknown>, key: string): number | null {
  const value = raw[key];
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

function rawText(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Occupancy and minimum nights — contracted fields, or GDS max_occupancy. */
export function occupancyLine(raw: Record<string, unknown>): string | null {
  const baseAdults = rawNumber(raw, "base_adults");
  const maxAdults = rawNumber(raw, "max_adults");
  const maxChildren = rawNumber(raw, "max_children");
  const maxOccupancy = rawNumber(raw, "max_occupancy");
  const minNights = rawNumber(raw, "min_nights");
  const parts: string[] = [];
  if (baseAdults != null) parts.push(`base ${baseAdults} ${baseAdults === 1 ? "adult" : "adults"}`);
  const limits = [
    maxAdults != null ? `${maxAdults} ${maxAdults === 1 ? "adult" : "adults"}` : null,
    maxChildren != null ? `${maxChildren} ${maxChildren === 1 ? "child" : "children"}` : null,
  ].filter(Boolean);
  if (limits.length > 0) parts.push(`up to ${limits.join(" or ")}`);
  else if (
    raw.sabre_multi_occupancy === true &&
    Array.isArray(raw.occupancy_per_room)
  ) {
    const perRoom = raw.occupancy_per_room
      .map((n) =>
        typeof n === "number" && Number.isFinite(n) && n >= 1
          ? Math.floor(n)
          : null,
      )
      .filter((n): n is number => n != null);
    if (perRoom.length >= 2) {
      parts.push(`occupancy ${perRoom.join(" / ")}`);
    } else if (maxOccupancy != null) {
      parts.push(`occupancy ${maxOccupancy}`);
    }
  } else if (maxOccupancy != null) {
    parts.push(`occupancy ${maxOccupancy}`);
  }
  if (minNights != null) parts.push(`minimum ${minNights} ${minNights === 1 ? "night" : "nights"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function stringList(raw: Record<string, unknown>, key: string): string[] {
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

type AmenityFlag = { label: string; complimentary: boolean | null };

function amenityFlags(raw: Record<string, unknown>, key: string): AmenityFlag[] {
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  const out: AmenityFlag[] = [];
  for (const row of value) {
    if (typeof row === "string" && row.trim()) {
      out.push({ label: row.trim(), complimentary: null });
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (!label) continue;
    const complimentary =
      rec.complimentary === true
        ? true
        : rec.complimentary === false
          ? false
          : null;
    out.push({ label, complimentary });
  }
  return out;
}

/** Room amenities are in-room features — names only, never free/charge labels. */
function roomAmenityNotes(
  flags: AmenityFlag[],
  fallbackLabels: string[],
): string | null {
  const labels =
    flags.length > 0
      ? flags.map((row) => row.label)
      : fallbackLabels;
  const unique = [...new Set(labels.map((label) => label.trim()).filter(Boolean))];
  if (unique.length === 0) return null;
  return `amenities ${unique.slice(0, 8).join(", ")}`;
}

/**
 * Hotel amenities: only call out may-be-chargeable when Sabre sets ComplimentaryInd false.
 * Other hotel amenities are on-property names only (no included/chargeable wording).
 */
function hotelAmenityNotes(
  flags: AmenityFlag[],
  fallbackLabels: string[],
): string | null {
  const rows =
    flags.length > 0
      ? flags
      : fallbackLabels.map((label) => ({ label, complimentary: null as boolean | null }));
  if (rows.length === 0) return null;
  const chargeable = rows
    .filter((row) => row.complimentary === false)
    .map((row) => row.label);
  const other = rows
    .filter((row) => row.complimentary !== false)
    .map((row) => row.label);
  const parts: string[] = [];
  if (other.length > 0) {
    parts.push(other.slice(0, 6).join(", "));
  }
  if (chargeable.length > 0) {
    parts.push(`may be chargeable ${chargeable.slice(0, 4).join(", ")}`);
  }
  return `hotel ${parts.join("; ")}`;
}

function roomLine(option: NormalizedRateOption, index: number): string {
  const room = option.room_name?.trim() || option.property_name?.trim() || "Room";
  const feeLines = stringList(option.raw, "fee_lines");
  const extraLines = stringList(option.raw, "room_extra_lines");
  const roomAmenityDetails = amenityFlags(option.raw, "room_amenity_details");
  const hotelAmenityDetails = amenityFlags(option.raw, "hotel_amenity_details");
  const roomAmenities = stringList(option.raw, "room_amenities");
  const hotelAmenities = stringList(option.raw, "hotel_amenities");
  const taxAmount = rawNumber(option.raw, "tax_amount");
  const bits = [
    `${index}. ${room}`,
    option.board ? `board ${option.board}` : null,
    `cost ${formatRoomMoney(option.cost_internal, option.currency)}`,
    typeof option.raw.cost_amount === "number" && typeof option.raw.cost_unit === "string"
      ? `${formatRoomMoney(option.raw.cost_amount, option.currency)} ${option.raw.cost_unit.replaceAll("_", " ")}`
      : null,
    typeof option.raw.package_nights === "number"
      ? `package nights ${option.raw.package_nights}`
      : null,
    typeof option.raw.extra_night_amount === "number"
      ? `extra night ${formatRoomMoney(option.raw.extra_night_amount, option.currency)}`
      : null,
    typeof option.raw.season_code === "string" && option.raw.season_code
      ? `season ${option.raw.season_code}`
      : null,
    occupancyLine(option.raw),
    rawText(option.raw, "rate_terms")
      ? `rate terms ${rawText(option.raw, "rate_terms")}`
      : null,
    taxAmount != null
      ? `tax ${formatRoomMoney(taxAmount, option.currency)}`
      : null,
    feeLines.length > 0 ? `fees (chargeable, in stay cost) ${feeLines.join("; ")}` : null,
    extraLines.length > 0
      ? `room extras (priced add-ons) ${extraLines.join("; ")}`
      : null,
    roomAmenityNotes(roomAmenityDetails, roomAmenities),
    hotelAmenityNotes(hotelAmenityDetails, hotelAmenities),
    rawText(option.raw, "rate_plan_description")
      ? `room details ${rawText(option.raw, "rate_plan_description")}`
      : null,
    rawText(option.raw, "notes"),
    option.inclusions.length > 0
      ? `Included: ${option.inclusions.join(", ")}`
      : "Included: not listed on this rate",
    option.cancellation_summary?.trim()
      ? `cancellation ${option.cancellation_summary.trim()}${
          typeof option.raw.cancel_deadline === "string" &&
          option.raw.cancel_deadline &&
          !/until/i.test(option.cancellation_summary)
            ? ` (cancel by ${option.raw.cancel_deadline})`
            : ""
        }`
      : typeof option.raw.cancel_deadline === "string" && option.raw.cancel_deadline
        ? `cancellation free cancel until ${option.raw.cancel_deadline}`
        : "cancellation not available yet",
    option.payment_summary?.trim()
      ? `payment ${option.payment_summary.trim()}`
      : "payment not available yet",
  ].filter(Boolean);
  return bits.join(". ") + ".";
}

/**
 * Plain-language copy of the filtered rows for this search.
 * Bank payout is left out. The model answers from this and does not recite it.
 */
function propertyTimesLine(options: NormalizedRateOption[]): string | null {
  for (const option of options) {
    const checkIn = rawText(option.raw, "hotel_check_in_time");
    const checkOut = rawText(option.raw, "hotel_check_out_time");
    if (checkIn && checkOut) {
      return `Property times: check-in ${checkIn}, check-out ${checkOut}.`;
    }
    if (checkIn) return `Property times: check-in ${checkIn}.`;
    if (checkOut) return `Property times: check-out ${checkOut}.`;
  }
  return null;
}

export function buildRateSearchNotes(
  options: NormalizedRateOption[],
  hotelBrief: string | null,
  _markupNote?: string | null,
): string {
  const hotel = options[0]?.property_name?.trim() || "This hotel";
  const stay =
    options[0] != null ? `${options[0].check_in} to ${options[0].check_out}` : "these dates";
  const rooms =
    options.length > 0
      ? options.map((option, index) => roomLine(option, index + 1)).join("\n")
      : "No room rate covers these dates.";
  const times = propertyTimesLine(options);
  const facts = hotelBrief?.trim() || "No other hotel facts for these dates.";
  return [
    `Hotel rates for ${hotel}, ${stay}. Cost is the advisor net. Sell needs a markup % or amount from the advisor — do not suggest a hotel minimum markup.`,
    times,
    "Rooms:",
    rooms,
    "Hotel facts:",
    facts,
  ]
    .filter(Boolean)
    .join("\n");
}
