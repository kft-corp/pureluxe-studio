const ASSIGN_CLIENT =
  /\b(add|assign|attach)\s+[A-Za-z]/i;

const NAME_STOP = new Set([
  "a",
  "an",
  "the",
  "client",
  "clients",
  "trip",
  "this",
  "my",
  "our",
  "please",
  "named",
  "called",
]);

/** Advisor asked to put a client on the open trip. */
export function wantsAssignClient(message: string): boolean {
  return ASSIGN_CLIENT.test(message);
}

/**
 * Best-effort person name from an intent sentence.
 * "create a trip for Sarah Chen" → "Sarah Chen".
 * Returns null when there is no usable name.
 */
export function clientNameFromMessage(message: string): string | null {
  const patterns = [
    /\b(?:for|about|named|called)\s+([A-Za-z][A-Za-z .'-]{1,80})/i,
    /\b(?:add|assign|use|attach)\s+([A-Za-z][A-Za-z .'-]{1,80})/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    const cleaned = raw
      .replace(/\b(to|on|for|this|the|trip|please|client)\b.*$/i, "")
      .replace(/[?.!,]+$/g, "")
      .trim();
    const words = cleaned.split(/\s+/).filter((word) => !NAME_STOP.has(word.toLowerCase()));
    const name = words.join(" ").trim();
    if (name.length >= 2) return name;
  }

  return null;
}
