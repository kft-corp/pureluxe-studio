import type { OptionsQuoteDocument, OptionsQuoteHotel } from "./options-quote-document";

export type QuoteLine = {
  id: string;
  label: string;
  text: string;
};

export type QuoteLineMatch = QuoteLine & {
  after: string;
};

/** Bullet lists the advisor can add to or clear (not letterhead). */
export const QUOTE_LIST_SECTIONS = [
  "inclusions",
  "extras",
  "arrival",
  "transfers",
  "shared",
] as const;

export type QuoteListSection = (typeof QUOTE_LIST_SECTIONS)[number];

/** Sections that can be wiped; scalars clear to empty, lists drop every line. */
export const QUOTE_CLEARABLE_SECTIONS = [
  ...QUOTE_LIST_SECTIONS,
  "notice",
  "notes",
  "board",
  "terms",
] as const;

export type QuoteClearableSection = (typeof QUOTE_CLEARABLE_SECTIONS)[number];

const BLOCKED =
  /\b(team cost|markup|confidential|bank payout|swift|booking code|commission)\b/i;

const LIST_LINE_ID =
  /^(?:room:[0-9a-f-]{36}:(?:inclusion|extra)|stay:\d+:hotel:\d+:(?:arrival|transfer|shared)):\d+$/i;

const CLEARABLE_SCALAR_ID =
  /^(?:notice|notes|room:[0-9a-f-]{36}:(?:detail|terms))$/i;

/** Words that stay off the client PDF even when the advisor asks. */
export function quoteLineBlocked(text: string): boolean {
  return BLOCKED.test(text);
}

/** List bullets and clearable scalars — empty text removes them from the PDF. */
export function isDeletableQuoteLineId(id: string): boolean {
  return LIST_LINE_ID.test(id) || CLEARABLE_SCALAR_ID.test(id);
}

/** Title, hotel/room names, prices, and stay facts stay; letterhead is never listed. */
export function isProtectedQuoteLineId(id: string): boolean {
  return !isDeletableQuoteLineId(id);
}

/** Append slot for a list line (room/hotel must exist on the document). */
export function isValidAppendLineId(id: string, document: OptionsQuoteDocument): boolean {
  const roomMatch = id.match(/^room:([0-9a-f-]{36}):(inclusion|extra):(\d+)$/i);
  if (roomMatch) {
    const room = findRoom(document, roomMatch[1]!);
    if (!room) return false;
    const index = Number(roomMatch[3]);
    return Number.isInteger(index) && index >= 0 && index < 80;
  }
  const hotelMatch = id.match(/^stay:(\d+):hotel:(\d+):(arrival|transfer|shared):(\d+)$/i);
  if (!hotelMatch) return false;
  const stay = document.stays[Number(hotelMatch[1])];
  const hotel = stay?.hotels[Number(hotelMatch[2])];
  if (!hotel) return false;
  const index = Number(hotelMatch[4]);
  return Number.isInteger(index) && index >= 0 && index < 80;
}

/** Lines the advisor can rewrite. Header and footer are not in this list. */
export function listQuoteLines(document: OptionsQuoteDocument): QuoteLine[] {
  const lines: QuoteLine[] = [];
  push(lines, "title", "Title", document.title);
  push(lines, "subtitle", "Place", document.subtitle);
  push(lines, "fact:preparedFor", "Prepared for", document.preparedFor);
  push(lines, "fact:dates", "Travel dates", document.dates);
  push(lines, "fact:guests", "Guests", document.guests);
  push(lines, "basis", "Price basis", document.basis);
  push(lines, "notice", "Notice", document.notice);
  document.stays.forEach((stay, stayIndex) => {
    push(lines, `stay:${stayIndex}:city`, "City", stay.city);
    push(lines, `stay:${stayIndex}:when`, "Stay", stay.when);
    push(lines, `stay:${stayIndex}:checkIn`, "Check-in", stay.checkInLabel);
    push(lines, `stay:${stayIndex}:checkOut`, "Check-out", stay.checkOutLabel);
    push(lines, `stay:${stayIndex}:occupancy`, "Occupancy", stay.occupancy);
    stay.hotels.forEach((hotel, hotelIndex) => {
      const hotelId = `stay:${stayIndex}:hotel:${hotelIndex}`;
      push(lines, `${hotelId}:name`, "Hotel", hotel.name);
      push(lines, `${hotelId}:city`, "Hotel city", hotel.city);
      for (const room of hotel.rooms) {
        push(lines, `room:${room.id}:name`, `Room · ${room.name}`, room.name);
        if (room.detail) push(lines, `room:${room.id}:detail`, `Meal plan · ${room.name}`, room.detail);
        if (room.sleeps) push(lines, `room:${room.id}:sleeps`, `Occupancy · ${room.name}`, room.sleeps);
        push(lines, `room:${room.id}:price`, `Price · ${room.name}`, room.price);
        room.inclusions.forEach((item, index) => {
          push(lines, `room:${room.id}:inclusion:${index}`, `Included · ${room.name}`, item);
        });
        room.extras.forEach((item, index) => {
          push(lines, `room:${room.id}:extra:${index}`, `This room · ${room.name}`, item);
        });
      }
      hotel.arrival.forEach((item, index) => {
        push(lines, `${hotelId}:arrival:${index}`, `Arrival · ${hotel.name}`, item);
      });
      hotel.transfers.forEach((item, index) => {
        push(lines, `${hotelId}:transfer:${index}`, `Transfer · ${hotel.name}`, item);
      });
      hotel.shared.forEach((item, index) => {
        push(lines, `${hotelId}:shared:${index}`, `For every room · ${hotel.name}`, item);
      });
      for (const term of quoteTermLines(hotel)) {
        push(lines, term.id, `Terms · ${term.label}`, term.text);
      }
    });
  });
  if (document.notes?.trim()) push(lines, "notes", "Note", document.notes);
  return lines;
}

/** Replace saved wording onto the document the PDF paints. */
export function applyQuoteEdits(
  document: OptionsQuoteDocument,
  edits: Record<string, string>,
): void {
  document.title = keep(edits, "title", document.title);
  document.subtitle = keep(edits, "subtitle", document.subtitle);
  document.preparedFor = keep(edits, "fact:preparedFor", document.preparedFor);
  document.dates = keep(edits, "fact:dates", document.dates);
  document.guests = keep(edits, "fact:guests", document.guests);
  document.basis = keep(edits, "basis", document.basis);
  if (Object.prototype.hasOwnProperty.call(edits, "notice")) {
    document.notice = edits.notice?.trim() ?? "";
  }
  if (Object.prototype.hasOwnProperty.call(edits, "notes")) {
    const notes = edits.notes?.trim() ?? "";
    document.notes = notes || null;
  }
  document.stays.forEach((stay, stayIndex) => {
    stay.city = keep(edits, `stay:${stayIndex}:city`, stay.city);
    stay.when = keep(edits, `stay:${stayIndex}:when`, stay.when);
    stay.checkInLabel = keep(edits, `stay:${stayIndex}:checkIn`, stay.checkInLabel);
    stay.checkOutLabel = keep(edits, `stay:${stayIndex}:checkOut`, stay.checkOutLabel);
    stay.occupancy = keep(edits, `stay:${stayIndex}:occupancy`, stay.occupancy);
    stay.hotels.forEach((hotel, hotelIndex) => {
      const hotelId = `stay:${stayIndex}:hotel:${hotelIndex}`;
      hotel.name = keep(edits, `${hotelId}:name`, hotel.name);
      hotel.city = keep(edits, `${hotelId}:city`, hotel.city);
      for (const room of hotel.rooms) {
        room.name = keep(edits, `room:${room.id}:name`, room.name);
        const detail = read(edits, `room:${room.id}:detail`);
        if (detail != null) room.detail = detail.trim() || null;
        const sleeps = read(edits, `room:${room.id}:sleeps`);
        if (sleeps != null) room.sleeps = sleeps.trim() || null;
        room.price = keep(edits, `room:${room.id}:price`, room.price);
        room.inclusions = editedLines(edits, room.inclusions, `room:${room.id}:inclusion`);
        room.extras = editedLines(edits, room.extras, `room:${room.id}:extra`);
        const terms = read(edits, `room:${room.id}:terms`);
        if (terms != null) room.terms = terms.trim() || "";
      }
      hotel.arrival = editedLines(edits, hotel.arrival, `${hotelId}:arrival`);
      hotel.transfers = editedLines(edits, hotel.transfers, `${hotelId}:transfer`);
      hotel.shared = editedLines(edits, hotel.shared, `${hotelId}:shared`);
    });
  });
}

/** Cancel lines as they are printed: one shared line, or one line per room. */
export function printedTermLines(hotel: OptionsQuoteHotel): string[] {
  return quoteTermLines(hotel).map((line) => line.text);
}

export function quoteTermLines(hotel: OptionsQuoteHotel): Array<{ id: string; label: string; text: string }> {
  const rows = hotel.rooms.flatMap((room) => {
    // Empty string means the advisor cleared terms; null means use supplier rules.
    if (room.terms === "") return [];
    const rule = [room.cancellation, room.payment].filter(Boolean).join(" ");
    const override = room.terms?.trim() || null;
    if (!rule && !override) return [];
    return [{ id: `room:${room.id}:terms`, label: room.name, rule, override }];
  });
  if (rows.length === 0) return [];
  if (rows.length === 1) {
    const only = rows[0]!;
    return [{ id: only.id, label: only.label, text: only.override ?? only.rule }];
  }
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    text: row.override ?? `${row.label}. ${row.rule}`,
  }));
}

/** Case-insensitive replace. Returns null when the words are not on that line. */
export function replaceInLine(text: string, find: string, replace: string): string | null {
  const direct = replaceLiteral(text, find, replace);
  if (direct) return direct;
  const digits = find.replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(digits)) return null;
  const withCommas = Number(digits).toLocaleString("en-US");
  if (withCommas.toLowerCase() === find.trim().toLowerCase()) return null;
  return replaceLiteral(text, withCommas, replace);
}

function replaceLiteral(text: string, find: string, replace: string): string | null {
  const needle = find.trim().toLowerCase();
  if (needle.length < 2) return null;
  const lower = text.toLowerCase();
  if (!lower.includes(needle)) return null;
  let out = "";
  let index = 0;
  while (index < text.length) {
    const at = lower.indexOf(needle, index);
    if (at < 0) {
      out += text.slice(index);
      break;
    }
    out += text.slice(index, at) + replace;
    index = at + needle.length;
  }
  return out === text ? null : out;
}

export function matchQuoteReplace(
  lines: QuoteLine[],
  find: string,
  replace: string,
): QuoteLineMatch[] {
  const matches: QuoteLineMatch[] = [];
  for (const line of lines) {
    const after = replaceInLine(line.text, find, replace);
    if (!after || quoteLineBlocked(after)) continue;
    matches.push({ ...line, after });
  }
  return matches;
}

/**
 * Apply list edits: empty text drops a line; keys past the current length append.
 */
function editedLines(edits: Record<string, string>, lines: string[], prefix: string): string[] {
  const prefixColon = `${prefix}:`;
  let maxIndex = lines.length - 1;
  for (const key of Object.keys(edits)) {
    if (!key.startsWith(prefixColon)) continue;
    const index = Number(key.slice(prefixColon.length));
    if (Number.isInteger(index) && index > maxIndex) maxIndex = index;
  }
  if (maxIndex < 0) return [];
  const out: string[] = [];
  for (let index = 0; index <= maxIndex; index++) {
    const next = read(edits, `${prefix}:${index}`);
    const value = (next ?? lines[index] ?? "").trim();
    if (value) out.push(value);
  }
  return out;
}

/** Wipe every line in a clearable section (hotel/room optional filters). */
export function clearSectionLineEdits(
  document: OptionsQuoteDocument,
  section: QuoteClearableSection,
  hotel?: string,
  room?: string,
): { id: string; text: string }[] {
  const edits: { id: string; text: string }[] = [];
  if (section === "notice") {
    if (document.notice?.trim()) edits.push({ id: "notice", text: "" });
    return edits;
  }
  if (section === "notes") {
    if (document.notes?.trim()) edits.push({ id: "notes", text: "" });
    return edits;
  }
  document.stays.forEach((stay, stayIndex) => {
    stay.hotels.forEach((hotelRow, hotelIndex) => {
      if (!nameMatches(hotelRow.name, hotel)) return;
      const hotelId = `stay:${stayIndex}:hotel:${hotelIndex}`;
      if (section === "arrival") {
        hotelRow.arrival.forEach((_, index) =>
          edits.push({ id: `${hotelId}:arrival:${index}`, text: "" }),
        );
      }
      if (section === "transfers") {
        hotelRow.transfers.forEach((_, index) =>
          edits.push({ id: `${hotelId}:transfer:${index}`, text: "" }),
        );
      }
      if (section === "shared") {
        hotelRow.shared.forEach((_, index) =>
          edits.push({ id: `${hotelId}:shared:${index}`, text: "" }),
        );
      }
      for (const roomRow of hotelRow.rooms) {
        if (!nameMatches(roomRow.name, room)) continue;
        if (section === "board" && roomRow.detail?.trim()) {
          edits.push({ id: `room:${roomRow.id}:detail`, text: "" });
        }
        if (section === "terms") {
          const term =
            roomRow.terms?.trim() ||
            [roomRow.cancellation, roomRow.payment].filter(Boolean).join(" ");
          if (term) edits.push({ id: `room:${roomRow.id}:terms`, text: "" });
        }
        if (section === "inclusions") {
          roomRow.inclusions.forEach((_, index) =>
            edits.push({ id: `room:${roomRow.id}:inclusion:${index}`, text: "" }),
          );
        }
        if (section === "extras") {
          roomRow.extras.forEach((_, index) =>
            edits.push({ id: `room:${roomRow.id}:extra:${index}`, text: "" }),
          );
        }
      }
    });
  });
  return edits;
}

/** Append bullets to list sections; indices continue past current lines. */
export function appendSectionLineEdits(
  document: OptionsQuoteDocument,
  lines: Array<{ section: QuoteListSection; text: string; hotel?: string; room?: string }>,
): { edits: { id: string; text: string }[]; missing: QuoteListSection | null } {
  const pending = new Map<string, number>();
  const edits: { id: string; text: string }[] = [];
  for (const row of lines) {
    const target = resolveListTarget(document, row.section, row.hotel, row.room);
    if (!target) return { edits: [], missing: row.section };
    const nextIndex = pending.get(target.prefix) ?? target.length;
    pending.set(target.prefix, nextIndex + 1);
    edits.push({ id: `${target.prefix}:${nextIndex}`, text: row.text.trim() });
  }
  return { edits, missing: null };
}

function resolveListTarget(
  document: OptionsQuoteDocument,
  section: QuoteListSection,
  hotel?: string,
  room?: string,
): { prefix: string; length: number } | null {
  for (let stayIndex = 0; stayIndex < document.stays.length; stayIndex++) {
    const stay = document.stays[stayIndex]!;
    for (let hotelIndex = 0; hotelIndex < stay.hotels.length; hotelIndex++) {
      const hotelRow = stay.hotels[hotelIndex]!;
      if (!nameMatches(hotelRow.name, hotel)) continue;
      const hotelId = `stay:${stayIndex}:hotel:${hotelIndex}`;
      if (section === "arrival") return { prefix: `${hotelId}:arrival`, length: hotelRow.arrival.length };
      if (section === "transfers") {
        return { prefix: `${hotelId}:transfer`, length: hotelRow.transfers.length };
      }
      if (section === "shared") return { prefix: `${hotelId}:shared`, length: hotelRow.shared.length };
      for (const roomRow of hotelRow.rooms) {
        if (!nameMatches(roomRow.name, room)) continue;
        if (section === "inclusions") {
          return { prefix: `room:${roomRow.id}:inclusion`, length: roomRow.inclusions.length };
        }
        if (section === "extras") {
          return { prefix: `room:${roomRow.id}:extra`, length: roomRow.extras.length };
        }
      }
    }
  }
  return null;
}

function findRoom(document: OptionsQuoteDocument, roomId: string) {
  for (const stay of document.stays) {
    for (const hotel of stay.hotels) {
      const room = hotel.rooms.find((row) => row.id === roomId);
      if (room) return room;
    }
  }
  return null;
}

function nameMatches(value: string, needle: string | undefined): boolean {
  if (!needle) return true;
  const left = value.trim().toLowerCase();
  const right = needle.trim().toLowerCase();
  return left === right || left.includes(right) || right.includes(left);
}

function push(lines: QuoteLine[], id: string, label: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  lines.push({ id, label, text: clean });
}

function read(edits: Record<string, string>, id: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(edits, id)) return null;
  return edits[id] ?? "";
}

function keep(edits: Record<string, string>, id: string, source: string): string {
  const next = read(edits, id);
  const clean = next?.trim() ?? "";
  return clean || source;
}
