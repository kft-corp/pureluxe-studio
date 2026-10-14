import { completeClaudeText } from "@pureluxe/ai";

import {
  listQuoteLines,
  matchQuoteReplace,
  quoteLineBlocked,
  type QuoteLine,
  type QuoteLineMatch,
} from "./options-quote-lines";
import { loadOptionsQuoteDocument } from "./options-quote";
import { getTripDetail } from "./get-trip-detail";

export type OptionsQuoteEditProposal =
  | { kind: "skip" }
  | { kind: "none"; message: string }
  | { kind: "matches"; matches: QuoteLineMatch[] };

const HEADER =
  /\b(header|footer|letterhead|company name|pureluxe international|kft corporation|mahalaxmi|info@kft|6902|kft\.travel)\b/i;
const CHANGE = /\b(?:change|replace|rename|update|rewrite)\b/i;
const STAY_COMMAND =
  /\b(lead|traveller|traveler|search rates|sell price|client price|adults|children|hotel|dates|stay)\b/i;
const QUOTE_BODY =
  /\b(options quote|options pdf|included|inclusion|policy|policies|benefit|cancellation|breakfast|half board|the note|the title|add text|instead of|rewrite|make it say)\b/i;

/**
 * Read the advisor's sentence against the lines on the current options PDF.
 * Nothing is saved here.
 */
export async function proposeOptionsQuoteEdit(
  tripId: string,
  message: string,
  actor: { memberId: string },
): Promise<OptionsQuoteEditProposal> {
  const detail = await getTripDetail(tripId, actor);
  const text = message.trim();
  if (HEADER.test(text) && CHANGE.test(text)) {
    return {
      kind: "none",
      message:
        "The header and footer stay as they are. You can change the title, the rooms, what's included, arrival, transfers, what applies to every room, what applies to one room, the cancellation line, and the note.",
    };
  }
  if (quoteLineBlocked(text)) {
    return {
      kind: "none",
      message: "Team cost, markup, bank details, and booking codes stay off the client quote.",
    };
  }

  const document = await loadOptionsQuoteDocument(detail);
  const lines = listQuoteLines(document);
  const local = parseQuoteReplace(text);
  if (local) {
    const matches = matchQuoteReplace(lines, local.find, local.replace);
    if (matches.length > 0) return { kind: "matches", matches };
    const named = namedQuoteLine(local.find, lines, local.replace);
    if (named) return { kind: "matches", matches: [named] };
    if (STAY_COMMAND.test(text) && !QUOTE_BODY.test(text)) return { kind: "skip" };
    return {
      kind: "none",
      message: `“${local.find}” is not on the options quote. The header and footer stay as they are.`,
    };
  }
  if (!QUOTE_BODY.test(text)) return { kind: "skip" };
  return proposeWithModel(text, lines);
}

function parseQuoteReplace(message: string): { find: string; replace: string } | null {
  const instead = message.match(
    /\binstead of\s+(.+?)\s*,?\s+\b(?:say|write|use|put|add)\b\s+(.+)$/i,
  );
  if (instead?.[1] && instead[2]) {
    return cleanPair(instead[1], instead[2]);
  }
  const change = message.match(
    /\b(?:change|replace|rename|update)\b\s+([\s\S]+?)\s+\b(?:to|with|into)\b\s+([\s\S]+)$/i,
  );
  if (!change?.[1] || !change[2]) return null;
  const find = change[1].replace(/^(?:the\s+)?(?:text|word|words|line)\s+/i, "");
  return cleanPair(find, change[2]);
}

function namedQuoteLine(
  find: string,
  lines: QuoteLine[],
  replace: string,
): QuoteLineMatch | null {
  const title = /^(?:the\s+)?(?:options\s+)?(?:quote\s+)?title$/i.test(find.trim());
  const notes = /^(?:the\s+)?(?:options\s+)?(?:quote\s+)?notes?$/i.test(find.trim());
  if (!title && !notes) return null;
  const id = title ? "title" : "notes";
  const after = replace.trim().slice(0, title ? 200 : 2000);
  if (!after || quoteLineBlocked(after)) return null;
  const line = lines.find((row) => row.id === id) ?? {
    id,
    label: title ? "Title" : "Note",
    text: "",
  };
  return { ...line, after };
}

function cleanPair(find: string, replace: string): { find: string; replace: string } | null {
  const left = unwrap(find).replace(/^(?:just|only)\s+/i, "");
  const right = unwrap(replace).replace(/^(?:the\s+)?(?:text|words?)\s+/i, "");
  if (left.length < 2 || !right) return null;
  return { find: left, replace: right };
}

function unwrap(value: string): string {
  return value
    .trim()
    .replace(/^["“']|["”']$/g, "")
    .trim()
    .slice(0, 500);
}

async function proposeWithModel(message: string, lines: QuoteLine[]): Promise<OptionsQuoteEditProposal> {
  const catalog = lines
    .slice(0, 80)
    .map((line) => `${line.id} | ${line.label} | ${line.text.slice(0, 400)}`)
    .join("\n");
  try {
    const raw = await completeClaudeText({
      maxTokens: 800,
      system: [
        "You edit lines on a client hotel options quote.",
        "Return JSON only.",
        "Use only line ids from the list. Do not add a line.",
        "Do not invent a price, a cancellation rule, or a benefit the advisor did not ask for.",
        "When they want the same words changed, return a replace action.",
        "When one line should be rewritten, return a set action with the full new line.",
        'Shapes: {"action":"replace","find":"HB","replace":"Half Board"}',
        '{"action":"set","lines":[{"id":"...","text":"..."}]}',
        '{"action":"none","message":"short reason"}',
      ].join(" "),
      user: `Lines:\n${catalog}\n\nAdvisor: ${message}`,
    });
    return readModelEdit(raw, lines, message);
  } catch {
    return {
      kind: "none",
      message: "I couldn't read that change. Try: change HB to Half Board.",
    };
  }
}

function readModelEdit(raw: string, lines: QuoteLine[], message: string): OptionsQuoteEditProposal {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { kind: "none", message: "I couldn't read that change. Try: change HB to Half Board." };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { kind: "none", message: "I couldn't read that change. Try: change HB to Half Board." };
  }
  if (!body || typeof body !== "object") {
    return { kind: "none", message: "I couldn't read that change. Try: change HB to Half Board." };
  }
  const record = body as Record<string, unknown>;
  if (record.action === "replace" && typeof record.find === "string" && typeof record.replace === "string") {
    const matches = matchQuoteReplace(lines, record.find, record.replace);
    if (matches.length === 0) {
      return { kind: "none", message: `“${record.find.trim()}” is not on the options quote.` };
    }
    return { kind: "matches", matches };
  }
  if (record.action === "set" && Array.isArray(record.lines)) {
    const byId = new Map(lines.map((line) => [line.id, line]));
    const matches: QuoteLineMatch[] = [];
    for (const row of record.lines.slice(0, 8)) {
      if (!row || typeof row !== "object") continue;
      const item = row as Record<string, unknown>;
      if (typeof item.id !== "string" || typeof item.text !== "string") continue;
      const line = byId.get(item.id);
      const after = item.text.trim().slice(0, 2000);
      if (!line || !after || after === line.text || quoteLineBlocked(after)) continue;
      if (inventedAmount(line.text, after, message)) continue;
      matches.push({ ...line, after });
    }
    if (matches.length === 0) {
      return {
        kind: "none",
        message: "I couldn't match that to a line on the options quote.",
      };
    }
    return { kind: "matches", matches };
  }
  const messageText = typeof record.message === "string" ? record.message.trim() : "";
  return {
    kind: "none",
    message: messageText || "I couldn't match that to a line on the options quote.",
  };
}

function inventedAmount(before: string, after: string, message: string): boolean {
  const amounts = after.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return amounts.some((amount) => {
    const plain = amount.replace(/,/g, "");
    return !before.includes(amount) && !before.includes(plain) && !message.includes(amount) && !message.includes(plain);
  });
}
