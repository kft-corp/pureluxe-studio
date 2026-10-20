/** What the agent sees in place of a sensitive value. */
export const REDACTED = "[shown to the advisor only]";

/** Keys whose values never enter agent memory, whatever their content. */
const SENSITIVE_KEY =
  /^(?:passport(?:_number)?|document_number|medication(?:_notes)?|emergency_contact(?:_name|_phone)?|iban|swift|bic|account_number|routing_number|sort_code|payout|bank(?:_details|_account)?)$/i;

/** "number: X", "number is X", "# X". */
const LINK = String.raw`(?:\s*(?:is|was|are|[:#=-]))*\s*`;

/** Labelled values in free text. A label keeps booking refs and room codes safe from false hits. */
const SENSITIVE_TEXT: RegExp[] = [
  new RegExp(String.raw`\b(passport(?:\s*(?:no\.?|number|#))?${LINK})(?=[A-Z]*\d)[A-Z0-9]{6,12}\b`, "gi"),
  new RegExp(String.raw`\b((?:swift|bic)(?:\s*code)?${LINK})[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\b`, "gi"),
  new RegExp(String.raw`\b((?:account|a\/c|acct)(?:\s*(?:no\.?|number|#))?${LINK})\d[\d\s-]{5,}\d\b`, "gi"),
  /\b((?:medication|medicines?)(?:\s*(?:is|are|[:#-]))+\s*)[^\n]+/gi,
  /\b((?:emergency\s+contact|emergency\s+phone)(?:\s*(?:is|[:#-]))+\s*)[^\n]+/gi,
];

/** IBANs need no label: two letters, two check digits, then 11–30 letters or digits. */
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b/g;

/** Remove passport numbers, medication, emergency contacts and bank details from text. */
export function redactText(text: string): string {
  let out = text;
  for (const pattern of SENSITIVE_TEXT) {
    out = out.replace(pattern, (_match, label: string) => `${label}${REDACTED}`);
  }
  return out.replace(IBAN, (match) => (/\d{6,}/.test(match.replace(/\s/g, "")) ? REDACTED : match));
}

/**
 * Deep copy with sensitive fields replaced. Runs on everything that enters agent
 * memory (typed text, tool results) so it is never saved in a checkpoint.
 */
export function redactSensitive<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) && entry != null ? REDACTED : redactValue(entry);
    }
    return out;
  }
  return value;
}
