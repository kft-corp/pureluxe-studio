import type { NormalizedRateOption } from "@pureluxe/rates";

import { clientPriceAtMarkup, formatRoomMoney, markupPercentFromNotes } from "./price-math";

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
  return /\b(?:rates?|prices?|costs?|rooms?|villas?|hotels?|stay|inclusions?|included|includes|cancel(?:lation)?|payment|offers?|markup|transfers?|seaplane|check-?in|check-?out|kids?|children|child|adults?|guests?|occupancy|honeymoons?|anniversar(?:y|ies)|groups?|stop sale|board|breakfast|lunch|dinner|tax|supplement|extras?|benefits?|policy|policies|package|nights?|booking code|complimentary|combinable)\b/i.test(
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

/** Occupancy and minimum nights stored on the contracted row. */
export function occupancyLine(raw: Record<string, unknown>): string | null {
  const baseAdults = rawNumber(raw, "base_adults");
  const maxAdults = rawNumber(raw, "max_adults");
  const maxChildren = rawNumber(raw, "max_children");
  const minNights = rawNumber(raw, "min_nights");
  const parts: string[] = [];
  if (baseAdults != null) parts.push(`base ${baseAdults} ${baseAdults === 1 ? "adult" : "adults"}`);
  const limits = [
    maxAdults != null ? `${maxAdults} ${maxAdults === 1 ? "adult" : "adults"}` : null,
    maxChildren != null ? `${maxChildren} ${maxChildren === 1 ? "child" : "children"}` : null,
  ].filter(Boolean);
  if (limits.length > 0) parts.push(`up to ${limits.join(" or ")}`);
  if (minNights != null) parts.push(`minimum ${minNights} ${minNights === 1 ? "night" : "nights"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

function money(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  return currency ? `${currency} ${formatted}` : formatted;
}

function roomLine(option: NormalizedRateOption, index: number, markupPercent: number | null): string {
  const room = option.room_name?.trim() || option.property_name?.trim() || "Room";
  const bits = [
    `${index}. ${room}`,
    option.board ? `board ${option.board}` : null,
    `team cost ${money(option.cost_internal, option.currency)}`,
    markupPercent == null
      ? null
      : `suggested client price at ${markupPercent}% markup ${formatRoomMoney(clientPriceAtMarkup(option.cost_internal, markupPercent), option.currency)}`,
    typeof option.raw.cost_amount === "number" && typeof option.raw.cost_unit === "string"
      ? `${money(option.raw.cost_amount, option.currency)} ${option.raw.cost_unit.replaceAll("_", " ")}`
      : null,
    typeof option.raw.package_nights === "number"
      ? `package nights ${option.raw.package_nights}`
      : null,
    typeof option.raw.extra_night_amount === "number"
      ? `extra night ${money(option.raw.extra_night_amount, option.currency)}`
      : null,
    typeof option.raw.season_code === "string" && option.raw.season_code
      ? `season ${option.raw.season_code}`
      : null,
    occupancyLine(option.raw),
    rawText(option.raw, "notes"),
    option.inclusions.length > 0 ? `included ${option.inclusions.join(", ")}` : "included not in PureLuxe",
    option.cancellation_summary?.trim()
      ? `cancellation ${option.cancellation_summary.trim()}`
      : "cancellation not in PureLuxe",
    option.payment_summary?.trim()
      ? `payment ${option.payment_summary.trim()}`
      : "payment not in PureLuxe",
  ].filter(Boolean);
  return bits.join(". ") + ".";
}

/**
 * Plain-language copy of the filtered rows for this search.
 * Bank payout is left out. The model answers from this and does not recite it.
 */
export function buildRateSearchNotes(
  options: NormalizedRateOption[],
  hotelBrief: string | null,
  markupNote?: string | null,
): string {
  const hotel = options[0]?.property_name?.trim() || "This hotel";
  const stay =
    options[0] != null ? `${options[0].check_in} to ${options[0].check_out}` : "these dates";
  const markupPercent = markupPercentFromNotes(markupNote);
  const rooms =
    options.length > 0
      ? options.map((option, index) => roomLine(option, index + 1, markupPercent)).join("\n")
      : "No room rate covers these dates.";
  const facts = hotelBrief?.trim() || "PureLuxe has no other hotel facts for these dates.";
  const suggestion =
    markupPercent == null
      ? "PureLuxe has no minimum markup, so there is no suggested client price."
      : `Suggested client price is the team cost plus the minimum markup of ${markupPercent}% in PureLuxe. It is not saved.`;
  return [
    `Hotel rates for ${hotel}, ${stay}. Team cost is the advisor cost. ${suggestion}`,
    "Rooms:",
    rooms,
    "Hotel facts in PureLuxe:",
    facts,
  ].join("\n");
}
