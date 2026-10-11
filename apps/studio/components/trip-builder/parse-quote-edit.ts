export type QuoteEdit = {
  field: "title" | "intro" | "notes" | "highlight";
  value: string;
};

const PATTERNS: Array<{ field: QuoteEdit["field"]; re: RegExp; max: number }> = [
  {
    field: "title",
    max: 200,
    re: /^(?:(?:set|change|update)\s+)?(?:the\s+)?title\s*(?:to|:)\s*(.+)$/i,
  },
  {
    field: "intro",
    max: 4000,
    re: /^(?:(?:set|change|update)\s+)?(?:the\s+)?intro(?:duction)?\s*(?:to|:)\s*(.+)$/i,
  },
  {
    field: "notes",
    max: 4000,
    re: /^(?:(?:set|change|update)\s+)?(?:the\s+)?notes?\s*(?:to|:)\s*(.+)$/i,
  },
  {
    field: "highlight",
    max: 200,
    re: /^(?:(?:add|set)\s+)?(?:the\s+)?highlight\s*(?:to|:)\s*(.+)$/i,
  },
];

/** One quote-wording change from a chat line. Hotel, dates, and sell are not parsed here. */
export function parseQuoteEdit(text: string): QuoteEdit | null {
  const trimmed = text.trim();
  for (const pattern of PATTERNS) {
    const value = trimmed.match(pattern.re)?.[1]?.trim();
    if (value) return { field: pattern.field, value: value.slice(0, pattern.max) };
  }
  return null;
}

export function quoteEditLabel(edit: QuoteEdit): string {
  if (edit.field === "highlight") return "Add highlight";
  if (edit.field === "title") return "Set title";
  if (edit.field === "intro") return "Set intro";
  return "Set notes";
}
