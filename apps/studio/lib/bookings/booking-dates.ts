/** Shared booking date / duration helpers (create, update, UI). */

/** Inclusive hotel-style nights between YYYY-MM-DD dates (UTC midnight). */
export function nightsBetween(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return null;
  }
  const nights = Math.round(
    (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
  );
  return nights >= 0 ? nights : null;
}
