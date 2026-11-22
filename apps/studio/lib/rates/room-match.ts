/**
 * Match advisor/agent room names to rate or quote rows without
 * confusing a short villa name with a split-stay package that contains it.
 */

export function normRoomKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** First · segment — the room type before meal / cancel tags. */
export function baseRoomName(title: string): string {
  return title.split(/\s*·\s*/)[0]?.trim() || title.trim();
}

/**
 * Score how well a candidate room title matches the needle.
 * Exact wins. Soft includes only when lengths are close — so
 * "Beach Villa with Pool" does not match
 * "2N Beach Villa with Pool + 2N Water Villa with Pool" and vice versa.
 * 0 = no match.
 */
export function roomTitleScore(candidateTitle: string, needle: string): number {
  const title = normRoomKey(candidateTitle);
  const want = normRoomKey(needle);
  if (!title || !want) return 0;
  if (title === want) return 10_000;

  const lengthGap = Math.abs(title.length - want.length);
  // Extra wording beyond a short nickname (e.g. "Water Villa" → "Water Villa with Pool").
  const near = lengthGap <= 24;

  if (near && (title.startsWith(want) || want.startsWith(title))) {
    return 5_000 - lengthGap;
  }
  if (near && title.includes(want)) {
    return 3_000 - lengthGap;
  }
  if (near && want.includes(title)) {
    return 1_000 - lengthGap;
  }

  // "Twin free cancellation" vs subtitle "Twin · Room only · Free cancel":
  // match on the room-type base so cancel hints can break the tie.
  const base = normRoomKey(baseRoomName(candidateTitle));
  if (base && (want === base || want.startsWith(`${base} `) || want.includes(` ${base} `))) {
    return 800;
  }
  return 0;
}

/**
 * Boost / penalise when the advisor names cancel family
 * (Twin free cancel vs Twin non-refundable).
 */
export function cancelHintBonus(
  cancellation: string | null | undefined,
  needle: string,
  extraHaystack?: string | null,
): number {
  const n = needle.toLowerCase();
  const c = `${cancellation ?? ""} ${extraHaystack ?? ""}`.toLowerCase();
  const wantsNonRefund = /non[\s-]?refund/.test(n);
  const wantsFree =
    (/free cancel|free cancellation|refundable/.test(n) || /free cancel until/.test(n)) &&
    !wantsNonRefund;
  if (wantsNonRefund) {
    return /non[\s-]?refund/.test(c) ? 500 : -500;
  }
  if (wantsFree) {
    return /free cancel|refundable/.test(c) && !/non[\s-]?refund/.test(c) ? 500 : -500;
  }
  return 0;
}

/** Client PDF suffix when two options share a room type at one hotel. */
export function cancelDisplaySuffix(
  cancellation: string | null | undefined,
  subtitle?: string | null,
): string | null {
  const text = `${cancellation ?? ""} ${subtitle ?? ""}`.toLowerCase();
  if (/non[\s-]?refundable|no refund|non[\s-]?refund/.test(text)) return "non-refundable";
  if (/free cancel|fully refundable|refundable|cancel(?:lation)? free/.test(text)) {
    return "free cancellation";
  }
  return null;
}

/** Best unique match, or null when none / ambiguous soft matches. */
export function bestRoomMatch<T>(
  items: readonly T[],
  needle: string,
  titleOf: (item: T) => string,
  cancellationOf?: (item: T) => string | null | undefined,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  let tied = false;
  for (const item of items) {
    const title = titleOf(item);
    const score =
      roomTitleScore(title, needle) +
      (cancellationOf ? cancelHintBonus(cancellationOf(item), needle, title) : 0);
    if (score === 0) continue;
    if (score > bestScore) {
      best = item;
      bestScore = score;
      tied = false;
    } else if (score === bestScore) {
      tied = true;
    }
  }
  if (!best || bestScore === 0) return null;
  // Any tie is ambiguous (including two exact "Twin" titles) — caller must
  // disambiguate (rate_ref, cancel hint, or unused-result pick).
  if (tied) return null;
  return best;
}

export function hotelNameMatch(left: string, right: string): boolean {
  const a = normRoomKey(left);
  const b = normRoomKey(right);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}
