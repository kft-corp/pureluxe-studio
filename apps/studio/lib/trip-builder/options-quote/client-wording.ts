/**
 * Client PDF wording — three layers (founder quote UX):
 *
 * 1. Structured facts — board, tax %, green tax, seaplane, kids FB when the
 *    whole line is a known trade concept.
 * 2. Templates — one client sentence per fact (glossary; safe + consistent).
 * 3. Pass-through — hotel-specific free text: expand embedded codes only,
 *    never invent prices or “already included” for unknown lines.
 *
 * Prefer structured rate/contract flags upstream when available; this module
 * classifies leftover supplier strings so new hotels stay dynamic.
 */

/** Founder #21: one seaplane phrase on the client PDF. */
export const SEAPLANE_SHARED =
  "Return seaplane transfer to and from the resort, shared with other guests";
export const SEAPLANE_PRIVATE = "Seaplane transfer to and from the resort";
/** Founder #21: included green tax wording. */
export const GREEN_TAX_INCLUDED = "Maldives green tax, already included in your price";

export type BoardCode = "uai" | "ai" | "hb" | "fb" | "bb" | "ro" | "ep";

/** Layer 1 — meaning, not prose. */
export type ClientFact =
  | { kind: "board"; code: BoardCode }
  | { kind: "breakfast" }
  | { kind: "green_tax"; status: "included" | "extra"; detail?: string }
  | {
      kind: "seaplane";
      shared: boolean;
      daylight?: boolean;
      amounts?: string[];
      extra?: boolean;
      childRates?: boolean;
    }
  | { kind: "service_charge"; percent: string; inPrice: boolean }
  | { kind: "gst"; percent: string; inPrice: boolean }
  | { kind: "tgst"; percent: string; inPrice: boolean }
  | { kind: "kids_fb"; maxKids?: number };

const BOARD_LABEL: Record<BoardCode, string> = {
  uai: "Ultra All Inclusive",
  ai: "All Inclusive",
  hb: "Half Board: dinner included each evening as well as breakfast",
  fb: "Full Board: breakfast, lunch and dinner included",
  bb: "Bed and Breakfast",
  ro: "Room Only",
  ep: "Room Only",
};

/** Short board label for room subtitle rows (HB → Half Board). */
const BOARD_SHORT: Record<BoardCode, string> = {
  uai: "Ultra All Inclusive",
  ai: "All Inclusive",
  hb: "Half Board",
  fb: "Full Board",
  bb: "Bed and Breakfast",
  ro: "Room Only",
  ep: "Room Only",
};

/** Exact whole-line aliases → structured fact (layer 1). */
const EXACT_FACT: Record<string, ClientFact> = {
  breakfast: { kind: "breakfast" },
  "daily breakfast": { kind: "breakfast" },
  hb: { kind: "board", code: "hb" },
  "half board": { kind: "board", code: "hb" },
  "dinner hb": { kind: "board", code: "hb" },
  "dinner (half board)": { kind: "board", code: "hb" },
  "dinner and transfers": { kind: "board", code: "hb" },
  fb: { kind: "board", code: "fb" },
  "full board": { kind: "board", code: "fb" },
  bb: { kind: "board", code: "bb" },
  "bed and breakfast": { kind: "board", code: "bb" },
  ai: { kind: "board", code: "ai" },
  "all inclusive": { kind: "board", code: "ai" },
  uai: { kind: "board", code: "uai" },
  "ultra all inclusive": { kind: "board", code: "uai" },
  ro: { kind: "board", code: "ro" },
  ep: { kind: "board", code: "ep" },
  "room only": { kind: "board", code: "ro" },
  "green tax": { kind: "green_tax", status: "included" },
  "maldives green tax": { kind: "green_tax", status: "included" },
  "shared return seaplane": { kind: "seaplane", shared: true },
  "shared seaplane": { kind: "seaplane", shared: true },
  "return seaplane": { kind: "seaplane", shared: true },
  seaplane: { kind: "seaplane", shared: true },
  transfers: { kind: "seaplane", shared: true },
};

const PERCENT_SC = /^(\d+(?:\.\d+)?)\s*%?\s*sc$/i;
const PERCENT_GST = /^(\d+(?:\.\d+)?)\s*%?\s*gst$/i;
const PERCENT_TGST = /^(\d+(?:\.\d+)?)\s*%?\s*t-?gst$/i;
const KIDS_FB =
  /^kids?\s*0\s*[-–to]+\s*11\s*fb(?:\s+kids?\s+menu)?(?:\s*\(?\s*upto\s*(\d+)\s*\)?)?$/i;
const SC_IN_LINE = /(\d+(?:\.\d+)?)\s*%?\s*sc\b/gi;
const GST_IN_LINE = /(\d+(?:\.\d+)?)\s*%?\s*gst\b/gi;
const BOARD_IN_LINE = /\b(uai|ai|hb|fb|bb|ro|ep)\b/gi;

const TEAM_WORDING =
  /\b(?:markup|confidential|advisor|ota|bedbank|payout|commission|booking code|wholesale)\b|@/i;

/** Board code → client label (structured board field on a rate). */
export function boardClientLabel(code: string | null | undefined, short = false): string | null {
  if (!code?.trim()) return null;
  const key = code.trim().toLowerCase().replace(/\./g, "") as BoardCode;
  if (!(key in BOARD_LABEL)) return code.trim();
  return short ? BOARD_SHORT[key] : BOARD_LABEL[key];
}

/**
 * Layer 1: turn a supplier string into a fact when the whole line is a known concept.
 * Returns null → layer 3 pass-through.
 */
export function classifyClientLine(text: string): ClientFact | null {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return null;

  const key = raw.toLowerCase();
  if (EXACT_FACT[key]) return EXACT_FACT[key]!;

  const sc = raw.match(PERCENT_SC);
  if (sc?.[1]) return { kind: "service_charge", percent: sc[1], inPrice: true };

  const gst = raw.match(PERCENT_GST);
  if (gst?.[1]) return { kind: "gst", percent: gst[1], inPrice: true };

  const tgst = raw.match(PERCENT_TGST);
  if (tgst?.[1]) return { kind: "tgst", percent: tgst[1], inPrice: true };

  const kids = raw.match(KIDS_FB);
  if (kids) {
    return {
      kind: "kids_fb",
      maxKids: kids[1] ? Number(kids[1]) : undefined,
    };
  }

  // Whole-line green tax (with or without amount).
  if (/^green\s*tax\b/i.test(raw) || /^maldives\s+green\s*tax\b/i.test(raw)) {
    const extra =
      /(?:USD|\$)\s*[\d,]+/i.test(raw) ||
      /\bper\s+person\b/i.test(raw) ||
      /\bnot\s+included\b/i.test(raw);
    if (extra) {
      return {
        kind: "green_tax",
        status: "extra",
        detail: raw.replace(/^not\s+included:\s*/i, "").replace(/\bgreen\s*tax\b/i, "Maldives green tax"),
      };
    }
    return { kind: "green_tax", status: "included" };
  }

  // Line is primarily seaplane (short / transfer-shaped), not a long hotel essay.
  if (/\bseaplane\b/i.test(raw) && isPrimarilySeaplaneLine(raw)) {
    return {
      kind: "seaplane",
      shared: !/\bprivate\b/i.test(raw),
      daylight: /\bdaylight\b/i.test(raw) || undefined,
      amounts: raw.match(/(?:USD|\$)\s*[\d,]+(?:\.\d+)?/gi) ?? undefined,
      extra: /\bextra\b/i.test(raw) || undefined,
      childRates: /\bchild\b/i.test(raw) || undefined,
    };
  }

  return null;
}

/** Layer 2: fact → client sentence. */
export function renderClientFact(fact: ClientFact): string {
  switch (fact.kind) {
    case "board":
      return BOARD_LABEL[fact.code];
    case "breakfast":
      return "Daily breakfast";
    case "green_tax":
      if (fact.status === "included") return GREEN_TAX_INCLUDED;
      return fact.detail?.trim() || "Maldives green tax";
    case "seaplane": {
      let base = fact.shared ? SEAPLANE_SHARED : SEAPLANE_PRIVATE;
      if (fact.daylight) base = `${base} (daylight hours only)`;
      const amounts = fact.amounts ?? [];
      if (amounts.length === 0) return base;
      const money = amounts.join(" / ");
      const who = fact.childRates
        ? `Extra: ${money} (adult / child where listed)`
        : fact.extra
          ? `Extra: ${money}`
          : money;
      return `${base}. ${who}`;
    }
    case "service_charge":
      return fact.inPrice
        ? `${fact.percent}% service charge, already included in your price`
        : `${fact.percent}% service charge`;
    case "gst":
      return fact.inPrice
        ? `${fact.percent}% Goods and Services Tax, already included in your price`
        : `${fact.percent}% Goods and Services Tax`;
    case "tgst":
      return fact.inPrice
        ? `${fact.percent}% TGST, already included in your price`
        : `${fact.percent}% TGST`;
    case "kids_fb":
      return fact.maxKids != null
        ? `Up to ${fact.maxKids} children aged 0–11 have full board from the children's menu`
        : "Children aged 0–11 have full board from the children's menu";
  }
}

/**
 * Layer 3: hotel-specific free text — expand embedded trade codes only.
 * Does not invent inclusions or “already included”.
 */
export function passThroughClientLine(text: string): string {
  let out = text.trim().replace(/\s+/g, " ");
  if (!out || TEAM_WORDING.test(out)) return "";

  out = out.replace(SC_IN_LINE, (_, n: string) => `${n}% service charge`);
  out = out.replace(GST_IN_LINE, (_, n: string) => `${n}% Goods and Services Tax`);
  out = out.replace(BOARD_IN_LINE, (code) => BOARD_SHORT[code.toLowerCase() as BoardCode] ?? code);

  // Light cleanup only.
  out = out.replace(/\s{2,}/g, " ").trim();
  if (!out) return "";
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/**
 * Full pipeline for one PDF / rewrite line:
 * classify → template, else soft pass-through.
 */
export function toClientLine(text: string): string {
  const raw = text.trim().replace(/\s+/g, " ");
  if (!raw) return raw;
  if (TEAM_WORDING.test(raw)) return "";

  const fact = classifyClientLine(raw);
  if (fact) return renderClientFact(fact);

  return passThroughClientLine(raw);
}

/** @deprecated Prefer toClientLine — kept for existing call sites. */
export function expandClientWording(text: string): string {
  return toClientLine(text);
}

/** True when toClientLine would change this line. */
export function needsClientWording(text: string): boolean {
  const next = toClientLine(text);
  return next !== text.trim().replace(/\s+/g, " ");
}

/** True when a policy line is about green tax or seaplane (founder #21). */
export function isGreenTaxOrSeaplaneLine(line: string): boolean {
  return /\bgreen\s*tax\b/i.test(line) || /\bseaplane\b/i.test(line);
}

/** True when the rate inclusions already cover this green tax / seaplane line. */
export function rateIncludesExtra(line: string, includedText: string): boolean {
  const inc = includedText.toLowerCase();
  if (!inc) return false;
  if (/\bgreen\s*tax\b/i.test(line) && /\bgreen\s*tax\b/i.test(inc)) return true;
  if (/\bseaplane\b/i.test(line) && /\bseaplane\b/i.test(inc)) return true;
  if (/\bseaplane\b/i.test(line) && /\btransfers?\b/i.test(inc)) return true;
  return false;
}

/** Priced or explicitly extra — belongs under Not included when not in the rate. */
export function isPricedOrExtraTransfer(line: string): boolean {
  return (
    /\bnot\s+included\b/i.test(line) ||
    /\bextra\b/i.test(line) ||
    /(?:USD|\$)\s*[\d,]+/i.test(line) ||
    /\bper\s+person\b/i.test(line)
  );
}

function isPrimarilySeaplaneLine(raw: string): boolean {
  // Long package essays that mention seaplane once stay as pass-through.
  if (raw.length > 160) return false;
  const withoutSeaplane = raw.replace(/\bseaplane\b/gi, "").replace(/\s+/g, " ").trim();
  // Mostly seaplane + short modifiers / money.
  return withoutSeaplane.length < 80;
}
