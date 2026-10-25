/** Nights in [checkIn, checkOut) as YYYY-MM-DD (UTC date parts). */
export function stayNights(checkIn: string, checkOut: string): string[] {
  const [y1, m1, d1] = checkIn.split("-").map(Number);
  const [y2, m2, d2] = checkOut.split("-").map(Number);
  const start = Date.UTC(y1!, m1! - 1, d1!);
  const end = Date.UTC(y2!, m2! - 1, d2!);
  if (!(end > start)) return [];

  const nights: string[] = [];
  for (let t = start; t < end; t += 86_400_000) {
    nights.push(new Date(t).toISOString().slice(0, 10));
  }
  return nights;
}

/** True when a contract/rate date band covers one night. */
export function coversNight(
  validFrom: string | null,
  validTo: string | null,
  night: string,
): boolean {
  const fromOk = validFrom == null || validFrom <= night;
  const toOk = validTo == null || validTo >= night;
  return fromOk && toOk;
}

/** True when a date band overlaps any night of the stay. */
export function overlapsStay(
  validFrom: string | null,
  validTo: string | null,
  checkIn: string,
  lastNight: string,
): boolean {
  const fromOk = validFrom == null || validFrom <= lastNight;
  const toOk = validTo == null || validTo >= checkIn;
  return fromOk && toOk;
}

export function previousCalendarDay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
