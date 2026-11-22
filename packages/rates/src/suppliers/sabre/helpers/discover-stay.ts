/** Default inventory window for open-GDS discover (hotel_find often has no dates). */
const DISCOVER_OFFSET_DAYS = 30;
const DISCOVER_NIGHTS = 2;

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Near-future stay for Sabre GetHotelAvail discover when trip dates are unknown.
 * +30 days, 2 nights (UTC date parts).
 *
 * This is an **inventory probe window** so Sabre returns hotel codes/names —
 * not the advisor’s guest stay. Stage 6 shop should use real trip dates.
 */
export function defaultDiscoverStayDates(
  from: Date = new Date(),
): { checkIn: string; checkOut: string } {
  const checkIn = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  checkIn.setUTCDate(checkIn.getUTCDate() + DISCOVER_OFFSET_DAYS);
  const checkOut = new Date(checkIn);
  checkOut.setUTCDate(checkOut.getUTCDate() + DISCOVER_NIGHTS);
  return { checkIn: toIsoDate(checkIn), checkOut: toIsoDate(checkOut) };
}
