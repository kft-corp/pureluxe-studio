/**
 * Client-safe option chips under the room name on the PDF.
 * Same idea as the chat rate table (Occupancy · Non-refund · Deposit) —
 * no team cost / cost-per-night.
 */

const MAX_CHIPS = 3;

function joinChips(parts: Array<string | null | undefined>): string | null {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const text = part?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    // Prepaid + Non-refund is the same commercial idea for clients.
    if (key === "prepaid" && (seen.has("non-refund") || seen.has("non-refundable"))) {
      continue;
    }
    seen.add(key);
    out.push(text);
    if (out.length >= MAX_CHIPS) break;
  }
  return out.length > 0 ? out.join(" · ") : null;
}

function cancelChip(summary: string | null | undefined): string | null {
  if (!summary?.trim()) return null;
  const text = summary.toLowerCase();
  if (/non[\s-]?refundable|no refund|no changes|no credit/.test(text)) {
    return "Non-refund";
  }
  if (/free cancel|fully refundable|refundable|cancel(?:lation)? free/.test(text)) {
    return "Free cancel";
  }
  return null;
}

function paymentChip(
  paymentSummary: string | null | undefined,
  raw: Record<string, unknown> | null | undefined,
): string | null {
  const rawTiming = raw?.payment_timing;
  if (rawTiming === "prepaid") return "Prepaid";
  if (rawTiming === "deposit") return "Deposit";
  if (rawTiming === "guarantee") return "Guarantee";
  if (rawTiming === "pay_at_hotel") return "Pay at hotel";
  if (raw?.advance_purchase === true || raw?.prepaid === true) return "Prepaid";

  const summary = (paymentSummary ?? "").toLowerCase();
  if (!summary) return null;
  if (/deposit/.test(summary) && !/no\s+deposit/.test(summary)) return "Deposit";
  if (/guarantee/.test(summary)) return "Guarantee";
  if (/pay at (the )?hotel|settle at (the )?hotel|pay later/.test(summary)) {
    return "Pay at hotel";
  }
  if (/prepaid|pre[\s-]?pay|paid in (full )?advance|full payment/.test(summary)) {
    return "Prepaid";
  }
  return null;
}

function occupancyChip(
  maxAdults: number | null | undefined,
  raw: Record<string, unknown> | null | undefined,
): string | null {
  // Dual-shop: show guests searched per room (e.g. Occupancy 2 / 1).
  if (raw?.sabre_multi_occupancy === true && Array.isArray(raw.occupancy_per_room)) {
    const perRoom = raw.occupancy_per_room
      .map((n) =>
        typeof n === "number" && Number.isFinite(n) && n >= 1 ? Math.floor(n) : null,
      )
      .filter((n): n is number => n != null);
    if (perRoom.length >= 2) return `Occupancy ${perRoom.join(" / ")}`;
  }
  const fromRaw =
    typeof raw?.max_occupancy === "number" && Number.isFinite(raw.max_occupancy)
      ? Math.floor(raw.max_occupancy)
      : null;
  const occ =
    fromRaw != null && fromRaw > 0
      ? fromRaw
      : maxAdults != null && maxAdults > 0
        ? maxAdults
        : null;
  return occ != null ? `Occupancy ${occ}` : null;
}

function bedChip(
  roomName: string,
  raw: Record<string, unknown> | null | undefined,
): string | null {
  const bed = typeof raw?.bed_type === "string" ? raw.bed_type.trim() : "";
  if (!bed) return null;
  const roomLower = roomName.trim().toLowerCase();
  if (!roomLower || bed.toLowerCase() === roomLower || roomLower.includes(bed.toLowerCase())) {
    return null;
  }
  return bed.length <= 18 ? bed : `${bed.slice(0, 17).trimEnd()}…`;
}

/**
 * Compact chips for one quote option — aligned with chat rate-table detail.
 */
export function clientOptionChips(input: {
  roomName: string;
  cancellation: string | null | undefined;
  payment: string | null | undefined;
  maxAdults?: number | null;
  raw?: Record<string, unknown> | null;
}): string | null {
  return joinChips([
    bedChip(input.roomName, input.raw ?? null),
    occupancyChip(input.maxAdults, input.raw ?? null),
    cancelChip(input.cancellation),
    paymentChip(input.payment, input.raw ?? null),
  ]);
}

/** Prefix for Cancellation / Payment / Differences when two options share a room name. */
export function optionPolicyLabel(name: string, chips: string | null | undefined): string {
  const base = name.split(/\s*·\s*/)[0]?.trim() || name.trim() || "Room";
  const chip = chips?.trim();
  if (!chip) return base;
  // Prefer cancel + payment bits for a short policy prefix.
  const bits = chip
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        /^(non[\s-]?refund|free cancel|refundable|prepaid|deposit|guarantee|pay at hotel)/i.test(
          part,
        ),
    );
  if (bits.length === 0) return `${base} · ${chip}`;
  return `${base} · ${bits.join(" · ")}`;
}
