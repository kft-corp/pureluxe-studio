export type StayDraft = {
  hotel: string;
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number | null;
  children: number | null;
  rooms: number | null;
};

const ISO_DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;
const LABELED =
  /(?:^|\n)\s*(hotel|property|city|destination|check[\s-]?in|check[\s-]?out|adults?|children|child|kids?|rooms?)\s*[:\-]\s*(.+)$/gim;

/**
 * Pull hotel / city / dates from free-typed advisor chat.
 * Supports ISO dates and simple `hotel:` / `city:` labels.
 */
export function parseStayMessage(
  text: string,
  options?: { partyOnly?: boolean },
): Partial<StayDraft> {
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
    if (key === "adults" || key === "adult") next.adults = countOrNull(value);
    if (key === "children" || key === "child" || key === "kids" || key === "kid") {
      next.children = countOrNull(value);
    }
    if (key === "rooms" || key === "room") next.rooms = countOrNull(value);
  }

  if (next.adults == null) next.adults = countAfter(trimmed, /adults?/);
  if (next.children == null) {
    next.children = /\bno\s+(?:children|child|kids?)\b/i.test(trimmed)
      ? 0
      : countAfter(trimmed, /children|child|kids?/);
  }
  if (next.rooms == null) next.rooms = countAfter(trimmed, /rooms?/);

  const dates = [...trimmed.matchAll(ISO_DATE)].map((m) => m[1]!);
  ISO_DATE.lastIndex = 0;
  const editingOut = isDateEdit(trimmed, "out");
  const editingIn = isDateEdit(trimmed, "in");

  if (editingOut && !next.checkOut) {
    next.checkOut = dateAfterTo(trimmed) ?? dates[dates.length - 1] ?? undefined;
  } else if (editingIn && !next.checkIn) {
    next.checkIn = dateAfterTo(trimmed) ?? dates[dates.length - 1] ?? undefined;
  } else if (!editingOut && !editingIn) {
    if (dates[0] && !next.checkIn) next.checkIn = dates[0];
    if (dates[1] && !next.checkOut) next.checkOut = dates[1];
  }

  const renamed = trimmed.match(
    /\b(?:change|chnage|update|set)\b[\s\S]{0,40}\b(?:hotel|property)\b[\s\S]{0,24}\bto\s+([A-Za-z0-9][^.\n]{1,120})/i,
  );
  if (renamed?.[1] && !next.hotel) {
    next.hotel = renamed[1].replace(ISO_DATE, " ").replace(/\s+/g, " ").trim();
  }

  if (options?.partyOnly || editingOut || editingIn) return next;

  const inCity = trimmed.match(/\bin\s+([A-Za-z][A-Za-z .'-]{1,48})(?:\s|,|$)/i);
  if (inCity?.[1] && !next.city) {
    next.city = inCity[1].replace(/\s+/g, " ").trim();
  }

  const partyOnly = trimmed
    .replace(LABELED, " ")
    .replace(/\b\d+\s*adults?\b/gi, " ")
    .replace(/\b\d+\s*(?:children|child|kids?)\b/gi, " ")
    .replace(/\bno\s+(?:children|child|kids?)\b/gi, " ")
    .replace(/\b\d+\s*rooms?\b/gi, " ")
    .trim();

  if (!next.hotel && partyOnly && !looksLikeStayCommand(partyOnly)) {
    let hotelPart = partyOnly;
    if (inCity?.index != null) hotelPart = trimmed.slice(0, inCity.index);
    hotelPart = hotelPart
      .replace(ISO_DATE, " ")
      .replace(/\b(to|through|thru|until|–|—|-)\b/gi, " ")
      .replace(/\s+/g, " ")
      .replace(/^[\s,;]+|[\s,;]+$/g, "");
    if (
      hotelPart.length >= 2 &&
      hotelPart.length <= 120 &&
      /\p{L}/u.test(hotelPart) &&
      !looksLikeStayCommand(hotelPart)
    ) {
      next.hotel = hotelPart.replace(/^for\s+/i, "").trim();
    }
  }

  return next;
}

const EDIT_VERB = /\b(change|chnage|update|set|move|switch|correct|fix)\b/i;
const STAY_COMMAND =
  /\b(check[\s-]?out|check[\s-]?in|change|chnage|update|correct|search|rates?|prices?|adults?|children|kids?|rooms?|add|leg)\b/i;

function isDateEdit(text: string, which: "in" | "out"): boolean {
  if (!EDIT_VERB.test(text)) return false;
  const field = which === "out" ? /\bcheck[\s-]?out\b/i : /\bcheck[\s-]?in\b/i;
  return field.test(text);
}

function looksLikeStayCommand(text: string): boolean {
  return STAY_COMMAND.test(text);
}

function dateAfterTo(text: string): string | undefined {
  return text.match(/\bto\s+(\d{4}-\d{2}-\d{2})\b/i)?.[1];
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
    adults: patch.adults ?? current.adults,
    children: patch.children ?? current.children,
    rooms: patch.rooms ?? current.rooms,
  };
}

export function partyReady(draft: StayDraft): boolean {
  return (
    draft.adults != null &&
    draft.adults >= 1 &&
    draft.children != null &&
    draft.children >= 0 &&
    draft.rooms != null &&
    draft.rooms >= 1
  );
}

function countOrNull(value: string): number | null {
  const match = value.match(/\d+/);
  if (!match) return null;
  const count = Number(match[0]);
  return Number.isInteger(count) ? count : null;
}

function countAfter(text: string, label: RegExp): number | null {
  const match = text.match(new RegExp(`\\b(\\d+)\\s*(?:${label.source})\\b`, "i"));
  if (!match?.[1]) return null;
  return Number(match[1]);
}

function normalizeDate(value: string): string | null {
  const iso = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return iso?.[1] ?? null;
}
