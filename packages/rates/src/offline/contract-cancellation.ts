/**
 * Cancel lines already stored on a contract's payment_rules.
 * Prepay text is left out. Nothing here is invented.
 */
export function cancellationLinesFromPolicies(
  policies: { payment_rules?: unknown[] } | null | undefined,
): string[] {
  const rules = Array.isArray(policies?.payment_rules) ? policies.payment_rules : [];
  const lines: string[] = [];
  for (const rule of rules) {
    const line = cancellationLine(rule);
    if (line) lines.push(line);
  }
  return lines;
}

/** One paragraph for a rate card and the saved line item. Null when no cancel rule is stored. */
export function cancellationSummaryFromPolicies(
  policies: { payment_rules?: unknown[] } | null | undefined,
): string | null {
  const lines = cancellationLinesFromPolicies(policies);
  return lines.length > 0 ? lines.join(" ") : null;
}

function cancellationLine(rule: unknown): string | null {
  if (typeof rule === "string") {
    const text = rule.trim();
    if (!text || !/\bcancel/i.test(text)) return null;
    return text.endsWith(".") ? text : `${text}.`;
  }
  if (!rule || typeof rule !== "object") return null;
  const row = rule as Record<string, unknown>;
  const season = typeof row.season === "string" ? row.season.trim() : "";
  const cancel = typeof row.cancel_days === "number" ? row.cancel_days : null;
  const charge = typeof row.charge_pct === "number" ? row.charge_pct : null;
  if (cancel == null && charge == null) return null;
  const detail =
    cancel != null && charge != null
      ? `cancel within ${cancel} days and the charge is ${charge}%`
      : cancel != null
        ? `cancel within ${cancel} days`
        : `cancellation charge is ${charge}%`;
  if (!season) {
    return `${detail.charAt(0).toUpperCase()}${detail.slice(1)}.`;
  }
  const label = season.charAt(0).toUpperCase() + season.slice(1);
  return `${label}: ${detail}.`;
}
