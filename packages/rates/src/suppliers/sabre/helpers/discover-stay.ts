/**
 * @deprecated Open-GDS suggest now uses Hotel Search (no stay dates).
 * Kept for any legacy CERT probes that still call GetHotelAvail by stay.
 */
const DISCOVER_OFFSET_DAYS = 30;
const DISCOVER_NIGHTS = 2;

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @deprecated Legacy GetHotelAvail probe window (+30 days, 2 nights UTC).
 * Open-GDS suggest uses Hotel Search and does not need this.
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
