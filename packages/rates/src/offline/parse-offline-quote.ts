import type { RateSourceCode } from "../types";
import type { RawRateInput } from "../results";

export type ParseOfflineQuoteInput = {
  paste_text: string;
  check_in: string;
  check_out: string;
  currency?: string;
  property_id?: string | null;
  property_name?: string | null;
  rate_source_code?: RateSourceCode;
};

export type ParseOfflineQuoteResult = {
  status: "ok" | "partial" | "empty";
  /** Ready for normalizeRate when status is ok or partial. */
  fields: RawRateInput | null;
  warnings: string[];
};

const MONEY_RE =
  /(?:USD|EUR|GBP|CHF|AED|\$|€|£)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/i;
const BARE_MONEY_RE =
  /(?:total|rate|cost|price|amount)[:\s]+([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i;
const BOARD_RE =
  /\b(BB|HB|FB|AI|RO|bed\s*&\s*breakfast|half\s*board|full\s*board|all\s*inclusive|room\s*only)\b/i;

function parseAmount(text: string): number | null {
  const match = text.match(MONEY_RE) ?? text.match(BARE_MONEY_RE);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function parseBoard(text: string): string | null {
  const match = text.match(BOARD_RE);
  return match?.[1]?.trim() ?? null;
}

function detectCurrency(text: string, fallback: string): string {
  const upper = text.toUpperCase();
  for (const code of ["USD", "EUR", "GBP", "CHF", "AED"] as const) {
    if (upper.includes(code)) return code;
  }
  if (text.includes("$")) return "USD";
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  return fallback;
}

/**
 * Heuristic paste → structured fields (no LLM yet).
 * Advisors can still edit before normalize / attach.
 */
export function parseOfflineQuote(
  input: ParseOfflineQuoteInput,
): ParseOfflineQuoteResult {
  const text = input.paste_text.trim();
  if (!text) {
    return { status: "empty", fields: null, warnings: ["Paste text is empty."] };
  }

  const warnings: string[] = [];
  const cost = parseAmount(text);
  if (cost == null) {
    warnings.push("Could not find a clear amount in the paste.");
  }

  const board = parseBoard(text);
  if (!board) {
    warnings.push("Board basis not detected.");
  }

  const currency = detectCurrency(text, input.currency ?? "USD");

  if (cost == null) {
    return { status: "empty", fields: null, warnings };
  }

  const fields: RawRateInput = {
    property_id: input.property_id ?? null,
    property_name: input.property_name ?? null,
    board,
    check_in: input.check_in,
    check_out: input.check_out,
    currency,
    cost_internal: cost,
    rate_source_code: input.rate_source_code ?? "offline_manual",
    inclusions: [],
    availability_status: "on_request",
    raw: { paste_text: text },
  };

  return {
    status: warnings.length > 0 ? "partial" : "ok",
    fields,
    warnings,
  };
}
