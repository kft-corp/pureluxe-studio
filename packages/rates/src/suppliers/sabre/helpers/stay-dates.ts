const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type StayDatesValidation =
  | { ok: true }
  | { ok: false; reason: "missing" | "format" | "order" };

/** Basic stay-date guard before calling Sabre GetHotelAvail. */
export function validateStayDates(
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): StayDatesValidation {
  const inDate = checkIn?.trim() ?? "";
  const outDate = checkOut?.trim() ?? "";

  if (!inDate || !outDate) {
    return { ok: false, reason: "missing" };
  }

  if (!ISO_DATE.test(inDate) || !ISO_DATE.test(outDate)) {
    return { ok: false, reason: "format" };
  }

  if (outDate <= inDate) {
    return { ok: false, reason: "order" };
  }

  return { ok: true };
}
