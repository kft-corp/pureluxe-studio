import { isTripQuestion } from "./questions";

const RATE_SEARCH =
  /\b(search|find|check|get|look up)\b[\s\S]{0,40}\b(rates?|prices?)\b|\b(price|prices|rates?)\b[\s\S]{0,24}\b(hotel|stay)\b/i;

/** Advisor asked to price the saved stay. */
export function wantsRateSearch(message: string): boolean {
  return RATE_SEARCH.test(message);
}

export type RateChoice = {
  title: string;
};

const ACTION =
  "(?:(?:the\\s+)?client\\s+(?:chose|picked|wants)|select|choose|use|pick|option|add|include|share)";
const LEAD = new RegExp(`^(?:please\\s+)?${ACTION}\\s+`, "i");
const NUMBER = new RegExp(`^(?:please\\s+)?${ACTION}\\s+#?(\\d{1,2})\\b`, "i");
const HASH = /^#(\d{1,2})$/;
const ORDINAL = new RegExp(
  `^(?:please\\s+)?(?:${ACTION}|the)\\s+(first|second|third|fourth|fifth|sixth)\\b`,
  "i",
);
const OPTIONS_TAIL =
  /\s+(?:to|on|for)\s+(?:the\s+)?(?:options(?:\s+quote)?|quote)\s*$/i;

const ORDINAL_INDEX: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "add 2 to the options quote" saves the room. "select 2" and "client chose 2" finalise it. */
export function isOptionsAdd(message: string): boolean {
  const text = message.trim();
  if (/\bclient\s+(?:chose|picked|wants)\b/i.test(text)) return false;
  return /^(?:please\s+)?(?:add|include|share)\b/i.test(text);
}

/**
 * Match a typed rate pick against the cards on the latest search.
 * "select 2" uses the card number. "select water villa" or the room name uses the title.
 * Returns "ambiguous" when more than one title fits.
 */
export function matchRateChoice<T extends RateChoice>(
  message: string,
  options: T[],
): T | "ambiguous" | null {
  const text = message.trim();
  if (!text || options.length === 0) return null;

  const numbered = text.match(NUMBER) ?? text.match(HASH);
  if (numbered?.[1]) {
    const index = Number(numbered[1]) - 1;
    return options[index] ?? null;
  }

  const ordinal = text.match(ORDINAL);
  const ordinalIndex = ordinal?.[1]
    ? ORDINAL_INDEX[ordinal[1].toLowerCase()]
    : undefined;
  if (ordinalIndex) {
    return options[ordinalIndex - 1] ?? null;
  }

  const led = LEAD.test(text);
  const body = (led ? text.replace(LEAD, "") : text)
    .replace(/[?.!]+$/g, "")
    .replace(OPTIONS_TAIL, "")
    .trim();
  const query = normalize(body);
  if (query.length < 2) return null;
  if (/^(yes|no|ok|okay|search|rates?|prices?)$/.test(query)) return null;

  const hits = options.filter((option) => {
    const title = normalize(option.title);
    if (!title) return false;
    if (title === query) return true;
    if (!led) return false;
    return title.includes(query) || query.includes(title);
  });

  if (hits.length === 1) return hits[0];
  if (hits.length > 1) return "ambiguous";
  return null;
}

function looksLikeSupplierQuote(text: string): boolean {
  return (
    /(?:USD|EUR|GBP|CHF|AED|\$|€|£)\s*[0-9]/i.test(text) ||
    /(?:total|rate|cost|price|amount)\s*[:=]?\s*[0-9]/i.test(text)
  );
}

/** A supplier total to save. A question that mentions a price is not one. */
export function isSupplierPaste(text: string): boolean {
  if (!looksLikeSupplierQuote(text)) return false;
  if (isTripQuestion(text)) return false;
  if (/\?\s*$/.test(text.trim())) return false;
  return true;
}

/** "sell 4500 USD" or "sell price: EUR 3200" sets the trip client price. USD when no currency is named. */
export function parseSellMessage(
  text: string,
): { sell_total: number; sell_currency: string } | null {
  const match = text.match(
    /\bsell(?:\s*(?:price|total))?\s*[:=]?\s*([A-Z]{3})?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Z]{3})?\b/i,
  );
  if (!match) return null;
  const amount = Number(match[2]);
  if (!Number.isFinite(amount)) return null;
  const currency = (match[1] || match[3] || "USD").toUpperCase();
  return { sell_total: amount, sell_currency: currency };
}
