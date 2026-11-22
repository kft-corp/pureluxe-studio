import type { ClientQuoteFacts } from "../stays/hotel-contract-facts";

type AmenityFlag = { label: string; complimentary: boolean | null };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringList(raw: Record<string, unknown>, key: string): string[] {
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function amenityFlags(raw: Record<string, unknown>, key: string): AmenityFlag[] {
  const value = raw[key];
  if (!Array.isArray(value)) return [];
  const out: AmenityFlag[] = [];
  for (const row of value) {
    if (typeof row === "string" && row.trim()) {
      out.push({ label: row.trim(), complimentary: null });
      continue;
    }
    const rec = asRecord(row);
    if (!rec) continue;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    if (!label) continue;
    const complimentary =
      rec.complimentary === true ? true : rec.complimentary === false ? false : null;
    out.push({ label, complimentary });
  }
  return out;
}

function ensureSentence(value: string): string {
  const text = value.trim();
  if (!text) return text;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function isZeroPricedExtra(line: string): boolean {
  return /:\s*(USD|EUR|GBP|JPY)?\s*0(?:\.0+)?\b/i.test(line);
}

/** Free / on-request extras (Cribs: free) — Good to know, never Not included. */
function isFreeExtra(line: string): boolean {
  return (
    isZeroPricedExtra(line) ||
    /:\s*free\b/i.test(line) ||
    /\b(at no (extra )?charge|no (extra )?charge|complimentary)\b/i.test(line)
  );
}

/** Extra-adult fees are advisor noise on a 1-adult quote — keep off the client PDF. */
function isExtraAdultCharge(line: string): boolean {
  return /\bextra adult\b/i.test(line);
}

function amenityTopic(label: string): string | null {
  if (/\b(internet|wifi|wi-?\s*fi)\b/i.test(label)) return "internet";
  if (/\bparking\b/i.test(label)) return "parking";
  if (/\bbreakfast\b/i.test(label)) return "breakfast";
  return null;
}

/**
 * Client PDF facts from a live GDS shop (Sabre raw on the saved rate).
 * Used when there is no contracted Rate Layer policy pack.
 * Emits the same buckets as contracted Rate Layer facts.
 */
export function gdsClientQuoteFactsFromRaw(
  raw: Record<string, unknown> | null | undefined,
): ClientQuoteFacts {
  const empty: ClientQuoteFacts = {
    arrival: [],
    transfers: [],
    stay: [],
    benefits: [],
    charges: [],
  };
  if (!raw) return empty;

  const stay: string[] = [];
  const benefits: string[] = [];
  const charges: string[] = [];
  const complimentaryTopics = new Set<string>();

  const tax =
    typeof raw.tax_amount === "number" && Number.isFinite(raw.tax_amount)
      ? raw.tax_amount
      : null;
  const feeLines = stringList(raw, "fee_lines");
  if ((tax != null && tax > 0) || feeLines.length > 0) {
    stay.push("Stay total includes tax and service charges.");
  }

  // Room amenities = in-room features — plain "Amenities: …" (always treated as free).
  const roomAmenityLabels = [
    ...new Set(
      [
        ...amenityFlags(raw, "room_amenity_details").map((row) => row.label),
        ...stringList(raw, "room_amenities"),
      ]
        .map((label) => label.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);
  if (roomAmenityLabels.length > 0) {
    benefits.push(ensureSentence(`Amenities: ${roomAmenityLabels.join(", ")}`));
  }

  // Hotel amenities: complimentary first so may-be-chargeable can skip the same topic.
  const hotelFlags = amenityFlags(raw, "hotel_amenity_details").slice(0, 10);
  for (const flag of hotelFlags) {
    if (flag.complimentary !== true) continue;
    benefits.push(ensureSentence(flag.label));
    const topic = amenityTopic(flag.label);
    if (topic) complimentaryTopics.add(topic);
  }
  for (const flag of hotelFlags) {
    if (flag.complimentary !== false) continue;
    const topic = amenityTopic(flag.label);
    if (topic && complimentaryTopics.has(topic)) continue;
    charges.push(ensureSentence(`${flag.label} may be chargeable at the hotel`));
  }

  for (const line of stringList(raw, "room_extra_lines").slice(0, 6)) {
    if (isExtraAdultCharge(line)) continue;
    if (isFreeExtra(line)) {
      const label = line.split(":")[0]?.trim() || line;
      benefits.push(ensureSentence(`${label} available at no extra charge`));
      continue;
    }
    charges.push(ensureSentence(line));
  }

  return {
    arrival: [],
    transfers: [],
    stay: [...new Set(stay)],
    benefits: [...new Set(benefits)].slice(0, 8),
    charges: [...new Set(charges)].slice(0, 8),
  };
}
