export type StayDraft = {
  hotel: string;
  city: string;
  checkIn: string;
  checkOut: string;
};

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const LABELED =
  /(?:^|\n)\s*(hotel|property|city|destination|check[\s-]?in|check[\s-]?out)\s*[:\-]\s*(.+)$/gim;

/**
 * Pull hotel / city / dates from free-typed advisor chat.
 * Supports ISO dates and simple `hotel:` / `city:` labels.
 */
export function parseStayMessage(text: string): Partial<StayDraft> {
  const next: Partial<StayDraft> = {};
  const trimmed = text.trim();
  if (!trimmed) return next;

  for (const match of trimmed.matchAll(LABELED)) {
    const key = match[1].toLowerCase().replace(/\s+/g, "");
    const value = match[2].trim();
    if (!value) continue;
    if (key === "hotel" || key === "property") next.hotel = value;
    if (key === "city" || key === "destination") next.city = value;
    if (key.startsWith("checkin")) next.checkIn = normalizeDate(value) ?? value;
    if (key.startsWith("checkout")) next.checkOut = normalizeDate(value) ?? value;
  }

  const dates = [...trimmed.matchAll(ISO_DATE)].map((m) => m[1]);
  if (dates[0] && !next.checkIn) next.checkIn = dates[0];
  if (dates[1] && !next.checkOut) next.checkOut = dates[1];

  const inCity = trimmed.match(/\bin\s+([A-Za-z][A-Za-z .'-]{1,48})(?:\s|,|$)/i);
  if (inCity?.[1] && !next.city) {
    next.city = inCity[1].replace(/\s+/g, " ").trim();
  }

  if (!next.hotel) {
    let hotelPart = trimmed;
    if (inCity?.index != null) hotelPart = trimmed.slice(0, inCity.index);
    hotelPart = hotelPart
      .replace(ISO_DATE, " ")
      .replace(/\b(to|through|thru|until|–|—|-)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (hotelPart.length >= 2 && hotelPart.length <= 120) {
      next.hotel = hotelPart.replace(/^for\s+/i, "").trim();
    }
  }

  return next;
}

export function mergeStayDraft(
  current: StayDraft,
  patch: Partial<StayDraft>,
): StayDraft {
  return {
    hotel: patch.hotel?.trim() || current.hotel,
    city: patch.city?.trim() || current.city,
    checkIn: patch.checkIn?.trim() || current.checkIn,
    checkOut: patch.checkOut?.trim() || current.checkOut,
  };
}

export function stayDraftReady(draft: StayDraft): boolean {
  return Boolean(
    draft.hotel.trim() &&
      draft.city.trim() &&
      draft.checkIn.trim() &&
      draft.checkOut.trim() &&
      draft.checkOut > draft.checkIn,
  );
}

function normalizeDate(value: string): string | null {
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return iso?.[1] ?? null;
}
