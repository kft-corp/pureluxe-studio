import type { NormalizedRateOption } from "../types";

/**
 * Persistent fields ready for trip_line_items insert/update.
 * Same shape whether the option came from Sabre, paste, or contracted.
 */
export type LineItemFields = {
  category: "accommodation";
  title: string;
  subtitle: string | null;
  details: string | null;
  property_id: string | null;
  property_name: string | null;
  currency: string;
  cost_internal: number;
  /** Set only when the supplier quote states a tax percent. */
  tax_percentage: number | null;
  availability_status: NormalizedRateOption["availability_status"];
  rate_source_code: string;
  inclusions: string[];
  cancellation_policy: string | null;
  payment_policy: string | null;
  /** Stay + board + availability for review UI / extracted_json. */
  extracted: {
    check_in: string;
    check_out: string;
    board: string | null;
    room_name: string | null;
    availability_status: NormalizedRateOption["availability_status"];
    recommended: boolean;
    /** GDS occupancy when Sabre sends Max; used on the options PDF. */
    max_adults?: number;
    /** Party frozen when the option was added — used for pending booking. */
    rooms?: number;
    adults?: number;
    children?: number;
    /** Short client-safe room note (plan description). */
    notes?: string;
    raw: Record<string, unknown>;
  };
};

/** Percent points from a supplier payload, for example 18 for 18%. */
export function taxPercentageFromRaw(
  raw: Record<string, unknown> | null | undefined,
): number | null {
  const value = raw?.tax_percentage;
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount;
}

function maxAdultsFromRaw(raw: Record<string, unknown> | null | undefined): number | null {
  const value = raw?.max_occupancy ?? raw?.max_adults;
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.floor(amount);
}

/** Positive whole number from raw or nested quote_meta (party frozen at add). */
function partyCountFromRaw(
  raw: Record<string, unknown> | null | undefined,
  key: "rooms" | "adults" | "children",
): number | null {
  if (!raw) return null;
  const meta =
    raw.quote_meta && typeof raw.quote_meta === "object"
      ? (raw.quote_meta as Record<string, unknown>)
      : null;
  const value = raw[key] ?? meta?.[key];
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (key !== "children" && amount <= 0) return null;
  return Math.floor(amount);
}

function clientNotesFromRaw(raw: Record<string, unknown> | null | undefined): string | null {
  if (!raw) return null;
  const plan =
    typeof raw.rate_plan_description === "string" ? raw.rate_plan_description.trim() : "";
  const blurb = typeof raw.rate_blurb === "string" ? raw.rate_blurb.trim() : "";
  const terms = typeof raw.rate_terms === "string" ? raw.rate_terms.trim() : "";
  const source = plan || (blurb && blurb !== terms ? blurb : "");
  if (!source) return null;
  if (
    /\b(full payment|non[\s-]?refundable|no changes|no credit|paid in (full )?advance)\b/i.test(
      source,
    ) &&
    source.length < 120
  ) {
    return null;
  }
  const sentence = source.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/)[0]?.trim() || source.trim();
  if (!sentence) return null;
  const clipped =
    sentence.length <= 200 ? sentence : `${sentence.slice(0, 199).trimEnd()}…`;
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

/** Hotel-only complimentary flags → inclusions. Room amenities stay under Amenities, not Included. */
function complimentaryHotelLabels(
  raw: Record<string, unknown> | null | undefined,
): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const rows = raw.hotel_amenity_details;
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    if (rec.complimentary !== true) continue;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (!label) continue;
    const id = label.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(label);
    if (out.length >= 6) return out;
  }
  return out;
}

/** Short cancel tag so two "Twin" rates stay distinct on the quote / PDF. */
function shortCancelTag(summary: string | null | undefined): string | null {
  if (!summary?.trim()) return null;
  if (/non[\s-]?refundable|no refund/i.test(summary)) return "Non-refund";
  const until = summary.match(/free cancel until\s+([^;]+)/i);
  if (until?.[1]) return `Free cancel until ${until[1].trim()}`;
  if (/free cancel/i.test(summary)) return "Free cancel";
  if (/refundable/i.test(summary)) return "Refundable";
  return null;
}

/** Build a stable line-item payload from any normalized option. */
export function toLineItemFields(
  option: NormalizedRateOption,
): LineItemFields {
  const title =
    option.property_name?.trim() ||
    option.room_name?.trim() ||
    `Rate (${option.rate_source_code})`;

  const cancelTag = shortCancelTag(option.cancellation_summary);
  const subtitleParts = [option.room_name, option.board, cancelTag].filter(
    Boolean,
  );
  const raw = option.raw ?? {};
  const inclusions = [...option.inclusions];
  const seenInc = new Set(inclusions.map((item) => item.trim().toLowerCase()).filter(Boolean));
  for (const label of complimentaryHotelLabels(raw)) {
    const key = label.toLowerCase();
    if (seenInc.has(key)) continue;
    seenInc.add(key);
    inclusions.push(label);
    if (inclusions.length >= 10) break;
  }
  const maxAdults = maxAdultsFromRaw(raw);
  const notes = clientNotesFromRaw(raw);
  const rooms = partyCountFromRaw(raw, "rooms");
  const adults = partyCountFromRaw(raw, "adults");
  const children = partyCountFromRaw(raw, "children");

  return {
    category: "accommodation",
    title,
    subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : null,
    details: null,
    property_id: option.property_id,
    property_name: option.property_name,
    currency: option.currency,
    cost_internal: option.cost_internal,
    tax_percentage: taxPercentageFromRaw(option.raw),
    availability_status: option.availability_status,
    rate_source_code: option.rate_source_code,
    inclusions,
    cancellation_policy: option.cancellation_summary,
    payment_policy: option.payment_summary,
    extracted: {
      check_in: option.check_in,
      check_out: option.check_out,
      board: option.board,
      room_name: option.room_name,
      availability_status: option.availability_status,
      recommended: option.recommended,
      ...(maxAdults != null ? { max_adults: maxAdults } : {}),
      ...(rooms != null ? { rooms } : {}),
      ...(adults != null ? { adults } : {}),
      ...(children != null ? { children } : {}),
      ...(notes ? { notes } : {}),
      raw: { ...raw },
    },
  };
}

export function toLineItemFieldsList(
  options: NormalizedRateOption[],
): LineItemFields[] {
  return options.map(toLineItemFields);
}
