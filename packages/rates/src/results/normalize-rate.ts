import type { NormalizedRateOption, RateSourceCode } from "../types";

/** Defaults applied when an adapter omits stay / currency fields. */
export type NormalizeRateDefaults = {
  check_in: string;
  check_out: string;
  currency?: string;
  property_id?: string | null;
};

/** Loose supplier / paste fields before ranking. */
export type RawRateInput = {
  property_id?: string | null;
  property_name?: string | null;
  room_name?: string | null;
  board?: string | null;
  check_in?: string;
  check_out?: string;
  currency?: string;
  cost_internal?: number;
  rate_source_code: RateSourceCode;
  inclusions?: unknown;
  cancellation_summary?: string | null;
  payment_summary?: string | null;
  availability_status?: NormalizedRateOption["availability_status"];
  raw?: Record<string, unknown> | null;
};

function asStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asInclusions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asCost(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asRaw(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

/**
 * Map any adapter / paste payload into the shared option shape.
 * Always returns every field — never undefined — so line items stay consistent.
 */
export function normalizeRate(
  input: RawRateInput,
  defaults?: NormalizeRateDefaults,
): NormalizedRateOption {
  const check_in =
    asStringOrNull(input.check_in) ?? defaults?.check_in ?? "";
  const check_out =
    asStringOrNull(input.check_out) ?? defaults?.check_out ?? "";
  const currency =
    asStringOrNull(input.currency)?.toUpperCase() ??
    defaults?.currency?.toUpperCase() ??
    "USD";

  return {
    property_id:
      asStringOrNull(input.property_id) ?? defaults?.property_id ?? null,
    property_name: asStringOrNull(input.property_name),
    room_name: asStringOrNull(input.room_name),
    board: asStringOrNull(input.board),
    check_in,
    check_out,
    currency,
    cost_internal: asCost(input.cost_internal),
    rate_source_code: input.rate_source_code,
    inclusions: asInclusions(input.inclusions),
    cancellation_summary: asStringOrNull(input.cancellation_summary),
    payment_summary: asStringOrNull(input.payment_summary),
    availability_status: input.availability_status ?? "unknown",
    recommended: false,
    raw: asRaw(input.raw),
  };
}
