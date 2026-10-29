import type { NormalizedRateOption } from "@pureluxe/rates";

import { occupancyLine } from "@/lib/rates/rate-search-pack";

export type ExplainedRate = {
  /** Room or rate name. */
  room: string;
  board: string | null;
  nights: number;
  nightsLabel: string;
  source: string;
  /** One sentence: how this price covers the stay. */
  why: string;
  /** Team cost for the full stay. */
  price: string;
  /** Base occupancy, maximum guests, and minimum nights. Null when not on the rate. */
  occupancy: string | null;
  benefits: string[];
  /** Cancel rules stored for this rate. Null when none are on file. */
  cancellation: string | null;
};

function nightsBetween(checkIn: string, checkOut: string): number {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const nights = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
  return nights > 0 ? nights : 0;
}

function money(amount: number, currency: string): string {
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
  return currency ? `${currency} ${formatted}` : formatted;
}

function rawNumber(raw: Record<string, unknown>, key: string): number | null {
  const value = raw[key];
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(amount) ? amount : null;
}

function rawText(raw: Record<string, unknown>, key: string): string | null {
  const value = raw[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function nightLabel(nights: number): string {
  if (!Number.isFinite(nights) || nights <= 0) return "this stay";
  return nights === 1 ? "1 night" : `${nights} nights`;
}

/** One cancel sentence for this stay. A full multi-season paragraph stays off the card. */
export function cancellationForStay(
  summary: string | null | undefined,
  season: string | null,
): string | null {
  const text = summary?.trim();
  if (!text) return null;
  const parts = text
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (season) {
    const match = parts.find((part) =>
      part.toLowerCase().startsWith(season.toLowerCase()),
    );
    return match ?? null;
  }
  return parts.length === 1 ? parts[0] : null;
}

function sourceLabel(code: string): string {
  if (code === "offline_contracted") return "Contracted rate";
  if (code === "offline_manual") return "Pasted quote";
  return code.replaceAll("_", " ");
}

/** Plain-language price for one search card, always for the stay's nights. */
export function explainRate(option: NormalizedRateOption): ExplainedRate {
  const nights = nightsBetween(option.check_in, option.check_out);
  const unit = rawText(option.raw, "cost_unit");
  const amount = rawNumber(option.raw, "cost_amount");
  const packageNights = rawNumber(option.raw, "package_nights");
  const extraNight = rawNumber(option.raw, "extra_night_amount");
  const currency = option.currency?.trim() || "";
  const priced = amount == null ? null : money(amount, currency);
  const stay = nightLabel(nights);

  let why = `Cost for ${stay}.`;
  if (unit === "per_night" && priced) {
    why = `${priced} per night × ${stay}.`;
  } else if (unit === "per_person" && priced) {
    why = `${priced} per adult for ${stay}.`;
  } else if (unit === "package" && priced && packageNights != null && packageNights > 0) {
    const extraCount = nights - packageNights;
    if (extraCount > 0 && extraNight != null) {
      const extraLabel = extraCount === 1 ? "1 extra night" : `${extraCount} extra nights`;
      why = `${priced} for ${nightLabel(packageNights)}, plus ${money(extraNight, currency)} × ${extraLabel}. Total covers ${stay}.`;
    } else {
      why = `${priced} package for ${stay}.`;
    }
  } else if (unit === "per_stay" && priced) {
    why = `${priced} for ${stay}.`;
  }

  const benefits = option.inclusions
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    room: option.room_name || option.property_name || "Room",
    board: option.board,
    nights,
    nightsLabel: stay,
    source: sourceLabel(option.rate_source_code),
    why,
    price: money(option.cost_internal, currency),
    occupancy: occupancyLine(option.raw),
    benefits,
    cancellation: cancellationForStay(
      option.cancellation_summary,
      rawText(option.raw, "season_code"),
    ),
  };
}
