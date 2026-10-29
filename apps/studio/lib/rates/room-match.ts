/**
 * Match advisor/agent room names to rate or quote rows without
 * confusing a short villa name with a split-stay package that contains it.
 */

export function normRoomKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
  return 0;
}

/** Best unique match, or null when none / ambiguous soft matches. */
export function bestRoomMatch<T>(
  items: readonly T[],
  needle: string,
  titleOf: (item: T) => string,
): T | null {
  let best: T | null = null;
  let bestScore = 0;
  let tied = false;
  for (const item of items) {
    const score = roomTitleScore(titleOf(item), needle);
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
  if (tied && bestScore < 10_000) return null;
  return best;
}

export function hotelNameMatch(left: string, right: string): boolean {
  const a = normRoomKey(left);
  const b = normRoomKey(right);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}
