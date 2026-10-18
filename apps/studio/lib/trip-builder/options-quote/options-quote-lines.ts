import type { OptionsQuoteDocument, OptionsQuoteHotel } from "./options-quote-document";

export type QuoteLine = {
  id: string;
  label: string;
  text: string;
};

export type QuoteLineMatch = QuoteLine & {
  after: string;
};

const BLOCKED =
  /\b(team cost|markup|confidential|bank payout|swift|booking code|commission)\b/i;

/** Words that stay off the client PDF even when the advisor asks. */
export function quoteLineBlocked(text: string): boolean {
  return BLOCKED.test(text);
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
        if (room.detail) push(lines, `room:${room.id}:detail`, `Board · ${room.name}`, room.detail);
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
  document.notice = keep(edits, "notice", document.notice);
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

function editedLines(edits: Record<string, string>, lines: string[], prefix: string): string[] {
  return lines
    .map((item, index) => read(edits, `${prefix}:${index}`) ?? item)
    .map((item) => item.trim())
    .filter(Boolean);
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
