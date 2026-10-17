export type MoneyReply = {
  amount: number;
  currency: string | null;
};

function moneyReply(amountRaw: string, currency: string | null): MoneyReply | null {
  const amount = Number(amountRaw.replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return { amount, currency: currency?.trim().toUpperCase() || null };
}

/** "2400", "2400 USD", or "USD 2400" while a room is waiting for its client price. */
export function parseMoneyReply(message: string): MoneyReply | null {
  const text = message.trim().replace(/[?.!]+$/g, "");
  const codeFirst = text.match(
    /^(?:(?:set\s+)?(?:the\s+)?(?:client|offer)\s+price\s+(?:to\s+|at\s+)?)?([A-Za-z]{3})\s+([0-9][0-9,]*(?:\.\d+)?)$/i,
  );
  if (codeFirst?.[1] && codeFirst[2]) return moneyReply(codeFirst[2], codeFirst[1]);
  const amountFirst = text.match(
    /^(?:(?:set\s+)?(?:the\s+)?(?:client|offer)\s+price\s+(?:to\s+|at\s+)?)?([0-9][0-9,]*(?:\.\d+)?)(?:\s+([A-Za-z]{3}))?$/i,
  );
  if (amountFirst?.[1]) return moneyReply(amountFirst[1], amountFirst[2] ?? null);
  return null;
}

/** Add the room now and leave the client price empty on the PDF. */
export function isPriceSkip(message: string): boolean {
  return /^(?:to be confirmed|no price(?: yet)?|skip(?: the)? price|price later|without a price|leave the price(?: empty)?)$/i.test(
    message.trim().replace(/[?.!]+$/g, ""),
  );
}

const PRICE_TAIL =
  /\s+(?:at|for)\s+(?:a\s+)?(?:(?:client|offer)\s+)?(?:price\s+(?:of\s+)?)?([0-9][0-9,]*(?:\.\d+)?)(?:\s+([A-Za-z]{3}))?\s*$/i;

/** "add the beach villa at 2400 USD" keeps the room words and the amount apart. */
export function splitTrailingPrice(message: string): { text: string; price: MoneyReply | null } {
  const trimmed = message.trim();
  const match = PRICE_TAIL.exec(trimmed);
  if (!match?.[1] || match.index == null) return { text: trimmed, price: null };
  const price = moneyReply(match[1], match[2] ?? null);
  if (!price) return { text: trimmed, price: null };
  return { text: trimmed.slice(0, match.index).trim(), price };
}

/** They asked to see the options PDF. */
export function wantsOptionsPreview(message: string): boolean {
  const text = message.trim();
  if (!/\boptions(?:\s+quote)?(?:\s+pdf)?\b/i.test(text)) return false;
  return /\b(?:show|open|view|preview|see|generate|regenerate|look)\b/i.test(text);
}

/** "options note:" and "options title:" belong to the options PDF. */
export function parseOptionsWording(
  message: string,
): { field: "title" | "notes"; value: string } | null {
  const text = message.trim();
  const title = text.match(
    /^(?:(?:set|change|update)\s+)?(?:the\s+)?options\s+(?:quote\s+)?title\s*(?:to|:)\s*(.+)$/i,
  );
  if (title?.[1]?.trim()) return { field: "title", value: title[1].trim().slice(0, 200) };
  const notes = text.match(
    /^(?:(?:set|change|update)\s+)?(?:the\s+)?options\s+(?:quote\s+)?notes?\s*(?:to|:)\s*(.+)$/i,
  );
  if (notes?.[1]?.trim()) return { field: "notes", value: notes[1].trim().slice(0, 4000) };
  return null;
}

/** A sentence that may rewrite a line on the options PDF. */
export function looksLikeOptionsPdfEdit(message: string): boolean {
  if (/\b(?:change|replace|rename|rewrite|instead of|add text|make it say)\b/i.test(message)) {
    return true;
  }
  return (
    /\bupdate\b/i.test(message) &&
    /\b(?:text|word|line|title|note|included|inclusion|policy|quote|pdf)\b/i.test(message)
  );
}

/** "client price 2400 OMR" or "client price 2400 OMR for the water villa". */
export function parseOptionClientPrice(message: string): {
  amount: number;
  currency: string | null;
  room: string | null;
} | null {
  const match = message.trim().match(
    /^(?:set\s+)?(?:the\s+)?(?:client|offer)\s+price\s+(?:to\s+|at\s+)?([0-9][0-9,]*(?:\.\d+)?)(?:\s+([A-Za-z]{3}))?(?:\s+for\s+(?:the\s+)?(.+))?$/i,
  );
  if (!match?.[1]) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount < 0) return null;
  const currency = match[2]?.trim().toUpperCase() || null;
  const room = match[3]?.replace(/[?.!]+$/g, "").trim() || null;
  return { amount, currency, room };
}
