/**
 * Dual-shop Sabre combo rooms on a quote line / pending booking.
 * Parent rate_key is null — each physical room keeps its own key + terms.
 */

export type ComboOccupancySegment = {
  /** Twin (2 adults) — room type + who sleeps there. */
  label: string;
  room_name: string;
  adults: number;
  children: number;
  board: string | null;
  cancellation_summary: string | null;
  payment_summary: string | null;
  payment_timing: string | null;
  rate_key: string | null;
  rate_plan_code: string | null;
  cost_internal: number | null;
  /** Ops fills after offline book (per room confirmation / PNR). */
  confirmation_ref?: string | null;
};

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function guestCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : fallback;
}

/** Shared with rate-compare / booking labels — "2 adults, 1 child". */
export function guestsPhrase(adults: number, children: number): string {
  const parts: string[] = [];
  if (adults > 0) parts.push(adults === 1 ? "1 adult" : `${adults} adults`);
  if (children > 0) {
    parts.push(children === 1 ? "1 child" : `${children} children`);
  }
  return parts.length > 0 ? parts.join(", ") : "guests";
}

function isSabreMultiOccupancyRaw(
  raw: Record<string, unknown> | null | undefined,
): boolean {
  return raw?.sabre_multi_occupancy === true;
}

/**
 * Read sabre_occupancy_segments from quote/booking raw.
 * Returns null when not a dual-shop combo.
 */
export function comboOccupancySegmentsFromRaw(
  raw: Record<string, unknown> | null | undefined,
): ComboOccupancySegment[] | null {
  if (!isSabreMultiOccupancyRaw(raw)) return null;
  const rows = raw!.sabre_occupancy_segments;
  if (!Array.isArray(rows) || rows.length < 2) return null;

  const segments: ComboOccupancySegment[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const roomName = textValue(rec.room_name) || `Room ${i + 1}`;
    const adults = Math.max(1, guestCount(rec.adults, 1));
    const children = guestCount(rec.children, 0);
    const guests = guestsPhrase(adults, children);
    const label =
      guests === "guests" ? roomName : `${roomName} (${guests})`;
    const cost =
      typeof rec.cost_internal === "number" && Number.isFinite(rec.cost_internal)
        ? rec.cost_internal
        : null;
    segments.push({
      label,
      room_name: roomName,
      adults,
      children,
      board: textValue(rec.board),
      cancellation_summary: textValue(rec.cancellation_summary),
      payment_summary: textValue(rec.payment_summary),
      payment_timing: textValue(rec.payment_timing),
      rate_key: textValue(rec.rate_key),
      rate_plan_code: textValue(rec.rate_plan_code),
      cost_internal: cost,
      confirmation_ref: textValue(rec.confirmation_ref),
    });
  }
  return segments.length >= 2 ? segments : null;
}

/** Advisor/ops one-liner for payment on a combo (room-type labels). */
export function comboPaymentHandoffLine(
  segments: ComboOccupancySegment[],
): string | null {
  const labeled = segments
    .map((segment) => {
      const pay = segment.payment_summary?.trim();
      return pay ? `${segment.label}: ${pay}` : null;
    })
    .filter((line): line is string => Boolean(line));
  if (labeled.length === 0) return null;
  const unique = new Set(
    labeled.map((line) => line.replace(/^[^:]+:\s*/i, "").toLowerCase()),
  );
  if (unique.size === 1) return labeled[0]!.replace(/^[^:]+:\s*/i, "");
  return labeled.join(" · ");
}

/** Advisor/ops one-liner for cancel on a combo. */
export function comboCancelHandoffLine(
  segments: ComboOccupancySegment[],
): string | null {
  const labeled = segments
    .map((segment) => {
      const cancel = segment.cancellation_summary?.trim();
      return cancel ? `${segment.label}: ${cancel}` : null;
    })
    .filter((line): line is string => Boolean(line));
  if (labeled.length === 0) return null;
  const unique = new Set(
    labeled.map((line) => line.replace(/^[^:]+:\s*/i, "").toLowerCase()),
  );
  if (unique.size === 1) return labeled[0]!.replace(/^[^:]+:\s*/i, "");
  return labeled.join(" · ");
}
