/**
 * Options quote PDF.
 * Layout follows docs/studio/client-quote.html: letterhead, trip facts,
 * one block per stay, then a hotel table. Drawn with PDFKit so the file
 * opens and downloads as a normal PDF. The painter reads OptionsQuoteDocument only.
 */

import { existsSync } from "node:fs";
import path from "node:path";

import PDFDocument from "pdfkit";

import type {
  OptionsQuoteDocument,
  OptionsQuoteHotel,
  OptionsQuoteRoom,
  OptionsQuoteStay,
} from "./options-quote-document";
import { printedTermLines } from "./options-quote-lines";

/** CSS pixels in the HTML sample, converted to PDF points (96px = 72pt). */
const PT = 72 / 96;
const px = (value: number) => Math.round(value * PT * 100) / 100;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const LEFT = px(56);
const RIGHT = PAGE_W - LEFT;
const WIDTH = RIGHT - LEFT;
const BOTTOM = px(48);

const TYPE = {
  label: px(10),
  brand: px(17),
  division: px(13),
  address: px(13.5),
  title: px(18),
  subtitle: px(12),
  body: px(13.5),
  basis: px(12),
  notice: px(12),
  city: px(18),
  when: px(13),
  hotel: px(14),
  hotelMeta: px(12),
  head: px(12),
  room: px(13),
  roomMeta: px(12),
  includedTitle: px(12.5),
  included: px(12.5),
  terms: px(12),
  notes: px(12),
  footer: px(11.5),
};

const INK = "#1c1c1c";
const MUTED = "#5e5e5e";
const GOLD = "#8d7040";
const CHARCOAL = "#2a2a2a";
const ROW = "#f4f4f4";
const LINE = "#e4e4e4";
const INCLUDED = "#f7f7f7";
const SAND = "#f0ebd7";
const HEAD = "#f3f3f3";
const WHITE = "#ffffff";

/** Same family as docs/studio/client-quote.html. Copied into assets/fonts so a deploy does not depend on node_modules. */
const FONT = {
  regular: "SourceSans",
  bold: "SourceSans-Bold",
  italic: "SourceSans-Italic",
} as const;

function sourceSansFile(file: string): string {
  const candidates = [
    path.join(process.cwd(), "assets", "fonts", file),
    path.join(process.cwd(), "apps", "studio", "assets", "fonts", file),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Missing font ${file}. Expected it under assets/fonts.`);
  }
  return found;
}

function useSourceSans(doc: PDFKit.PDFDocument) {
  doc.registerFont(FONT.regular, sourceSansFile("source-sans-3-latin-400-normal.woff"));
  doc.registerFont(FONT.bold, sourceSansFile("source-sans-3-latin-700-normal.woff"));
  doc.registerFont(FONT.italic, sourceSansFile("source-sans-3-latin-400-italic.woff"));
}

const ADDRESS = [
  "15/2, Mahalaxmi Industrial Estate",
  "Dainik Shivneri Marg, Lower Parel",
  "Mumbai 400013",
];

/** Build the options quote PDF from a document already filled with this trip. */
export function buildOptionsQuotePdf(quote: OptionsQuoteDocument): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: LEFT,
      bufferPages: true,
      info: {
        Title: quote.title,
        Author: "PureLuxe International Limited",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    doc.on("error", reject);
    useSourceSans(doc);
    paint(doc, quote);
    const pages = doc.bufferedPageRange();
    for (let index = 0; index < pages.count; index += 1) {
      doc.switchToPage(index);
      doc.page.margins.bottom = 0;
      doc
        .font(FONT.regular)
        .fontSize(TYPE.footer)
        .fillColor(MUTED)
        .text(
          "PureLuxe International Limited  ·  info@kft.travel  ·  +91 22 6902 5555  ·  kft.travel",
          LEFT,
          PAGE_H - px(28),
          { width: WIDTH, align: "center", lineBreak: false },
        );
    }
    doc.end();
  });
}

const AIR = 4;

function paint(doc: PDFKit.PDFDocument, quote: OptionsQuoteDocument) {
  let y = px(42);
  y = letterhead(doc, quote, y);
  y = facts(doc, quote, y + 2);
  y = paragraph(doc, quote.basis, y + 8, {
    size: TYPE.basis,
    font: FONT.bold,
    color: GOLD,
    lineGap: px(2),
  });
  y = paragraph(doc, quote.notice, y + 6, {
    size: TYPE.notice,
    font: FONT.regular,
    color: MUTED,
    lineGap: px(4),
  });

  for (const stay of quote.stays) y = paintStay(doc, stay, y + 14);

  if (quote.notes?.trim()) {
    y = ensure(doc, y, px(40));
    y += 10;
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(INK).lineWidth(0.6).stroke();
    y = paragraph(doc, quote.notes.trim(), y + 8, {
      size: TYPE.notes,
      font: FONT.regular,
      color: INK,
      lineGap: px(4),
    });
  }
  doc.y = y;
}

function letterhead(doc: PDFKit.PDFDocument, quote: OptionsQuoteDocument, y: number): number {
  const top = y;
  const gap = px(28);
  const leftWidth = (WIDTH - gap) * 0.58;
  const addressX = LEFT + leftWidth + gap;
  const brandY = top + TYPE.label + AIR;
  const divisionY = brandY + TYPE.brand + AIR;
  label(doc, "COMPANY", LEFT, top);
  label(doc, "ADDRESS", addressX, top);
  doc.font(FONT.bold).fontSize(TYPE.brand).fillColor(INK).text("PureLuxe International Limited", LEFT, brandY, {
    width: leftWidth,
    lineBreak: false,
    characterSpacing: -0.1,
  });
  doc.font(FONT.regular).fontSize(TYPE.division).fillColor(MUTED).text("A division of KFT Corporation", LEFT, divisionY, {
    width: leftWidth,
    lineBreak: false,
  });
  ADDRESS.forEach((line, index) => {
    doc.font(FONT.regular).fontSize(TYPE.address).fillColor(INK).text(line, addressX, brandY + index * (TYPE.address + AIR), {
      width: WIDTH - leftWidth - gap,
      lineBreak: false,
    });
  });
  const addressBottom = brandY + (ADDRESS.length - 1) * (TYPE.address + AIR) + TYPE.address;
  y = Math.max(divisionY + TYPE.division, addressBottom) + 8;
  doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(CHARCOAL).lineWidth(1.25).stroke();
  y += 12;
  doc.font(FONT.bold).fontSize(TYPE.title).fillColor(INK).text(quote.title, LEFT, y, {
    width: WIDTH,
    lineGap: px(1),
  });
  y = doc.y + 3;
  doc.font(FONT.regular).fontSize(TYPE.subtitle).fillColor(INK).text(quote.subtitle, LEFT, y, { width: WIDTH });
  return doc.y + 10;
}

function facts(doc: PDFKit.PDFDocument, quote: OptionsQuoteDocument, y: number): number {
  const rows: Array<[string, string]> = [
    ["Prepared for", quote.preparedFor],
    ["Travel dates", quote.dates],
    ["Guests", quote.guests],
  ];
  const labelWidth = px(126);
  for (const [name, value] of rows) {
    doc.font(FONT.bold).fontSize(TYPE.body).fillColor(INK).text(name, LEFT, y, {
      width: labelWidth,
      lineBreak: false,
    });
    doc.font(FONT.regular).fontSize(TYPE.body).fillColor(INK).text(value, LEFT + labelWidth + px(8), y, {
      width: WIDTH - labelWidth - px(8),
      lineGap: px(2),
    });
    y = Math.max(y + TYPE.body + 4, doc.y + 4);
  }
  return y;
}

function paintStay(doc: PDFKit.PDFDocument, stay: OptionsQuoteStay, y: number): number {
  y = ensure(doc, y, px(72));
  doc.font(FONT.bold).fontSize(TYPE.city).fillColor(INK).text(stay.city, LEFT, y, { width: WIDTH });
  y = doc.y + 3;
  doc.font(FONT.regular).fontSize(TYPE.when).fillColor(MUTED).text(stay.when, LEFT, y, { width: WIDTH });
  y = doc.y + 7;
  const columns: Array<[string, string]> = [
    ["Check-in", stay.checkInLabel],
    ["Check-out", stay.checkOutLabel],
    ["Occupancy", stay.occupancy],
  ];
  const col = WIDTH / 3;
  const valueY = y + TYPE.label + 3;
  columns.forEach(([name, value], index) => {
    const x = LEFT + col * index;
    label(doc, name, x, y, col - px(8));
    doc.font(FONT.bold).fontSize(TYPE.body).fillColor(INK).text(value, x, valueY, {
      width: col - px(8),
      lineBreak: false,
    });
  });
  y = valueY + TYPE.body + 8;
  for (const hotel of stay.hotels) y = paintHotel(doc, hotel, y);
  return y;
}

function paintHotel(doc: PDFKit.PDFDocument, hotel: OptionsQuoteHotel, y: number): number {
  const currency = sharedCurrency(hotel.rooms);
  const heading = currency ? `Total (${currency})` : "Total";
  const sameInclusions = sharedList(hotel.rooms.map((room) => room.inclusions));
  const terms = hotelTermLines(hotel);
  const block =
    58 +
    hotel.rooms.reduce((sum, room) => sum + roomHeight(doc, room, !sameInclusions), 0) +
    (sameInclusions ? bulletHeight(doc, hotel.rooms[0]?.inclusions ?? []) : 0) +
    bulletHeight(doc, hotel.arrival) +
    bulletHeight(doc, hotel.transfers) +
    bulletHeight(doc, hotel.shared) +
    (terms.length > 0 ? termHeight(doc, terms) : 0);
  y = ensure(doc, y, Math.min(block, px(220)));
  const cardTop = y;
  const cardPage = doc.bufferedPageRange().count;
  const barHeight = 8 + TYPE.hotel + (hotel.city ? 3 + TYPE.hotelMeta : 0) + 8;

  doc.rect(LEFT, y, WIDTH, barHeight).fill(CHARCOAL);
  doc
    .font(FONT.bold)
    .fontSize(TYPE.hotel)
    .fillColor(WHITE)
    .text(fitLine(doc, hotel.name.toUpperCase(), FONT.bold, TYPE.hotel, WIDTH - px(28)), LEFT + px(14), y + 7, {
      width: WIDTH - px(28),
      lineBreak: false,
      characterSpacing: 0.35,
    });
  if (hotel.city) {
    doc.font(FONT.regular).fontSize(TYPE.hotelMeta).fillColor("#d9d9d9").text(hotel.city, LEFT + px(14), y + 7 + TYPE.hotel + 2, {
      width: WIDTH - px(28),
      lineBreak: false,
    });
  }
  y += barHeight;

  const headHeight = 22;
  doc.rect(LEFT, y, WIDTH, headHeight).fill(HEAD);
  const headTextY = y + (headHeight - TYPE.head) / 2;
  doc.font(FONT.bold).fontSize(TYPE.head).fillColor(INK);
  doc.text("Room", LEFT + px(14), headTextY, { width: WIDTH - priceColumn() - px(20), lineBreak: false });
  doc.text(heading, LEFT + WIDTH - priceColumn(), headTextY, {
    width: priceColumn() - px(14),
    align: "right",
    lineBreak: false,
  });
  y += headHeight;

  hotel.rooms.forEach((room, index) => {
    y = paintRoom(doc, room, y, currency, index % 2 === 1, !sameInclusions);
  });

  if (sameInclusions) y = paintBullets(doc, "What's included", hotel.rooms[0]?.inclusions ?? [], y);
  y = paintBullets(doc, "Arrival and departure", hotel.arrival, y);
  y = paintBullets(doc, "Transfers", hotel.transfers, y);
  y = paintBullets(doc, "For every room", hotel.shared, y);
  if (terms.length > 0) y = paintTerms(doc, terms, y);
  if (doc.bufferedPageRange().count === cardPage) {
    doc.rect(LEFT, cardTop, WIDTH, y - cardTop).lineWidth(0.6).strokeColor(LINE).stroke();
  }
  return y + 10;
}

function fitLine(doc: PDFKit.PDFDocument, value: string, font: string, size: number, width: number): string {
  doc.font(font).fontSize(size);
  if (doc.widthOfString(value) <= width) return value;
  let cut = value;
  while (cut.length > 1 && doc.widthOfString(`${cut}...`) > width) cut = cut.slice(0, -1);
  return `${cut.trim()}...`;
}

function paintRoom(
  doc: PDFKit.PDFDocument,
  room: OptionsQuoteRoom,
  y: number,
  shared: string | null,
  shaded: boolean,
  showInclusions: boolean,
): number {
  const height = roomHeight(doc, room, showInclusions);
  y = ensure(doc, y, height);
  if (shaded) doc.rect(LEFT, y, WIDTH, height).fill(ROW);
  const amount =
    room.price === "To be confirmed" || shared
      ? room.price
      : `${room.currency ?? ""} ${room.price}`.trim();
  const textWidth = WIDTH - priceColumn() - px(20);
  doc.font(FONT.bold).fontSize(TYPE.room).fillColor(INK).text(room.name, LEFT + px(14), y + 7, {
    width: textWidth,
  });
  let textY = doc.y;
  if (room.detail) {
    doc.font(FONT.regular).fontSize(TYPE.roomMeta).fillColor(MUTED).text(room.detail, LEFT + px(14), textY + 1, {
      width: textWidth,
    });
    textY = doc.y;
  }
  if (showInclusions && room.inclusions.length > 0) {
    doc.font(FONT.regular).fontSize(TYPE.roomMeta).fillColor(MUTED).text(room.inclusions.join("  ·  "), LEFT + px(14), textY + px(2), {
      width: textWidth,
    });
    textY = doc.y;
  }
  if (room.extras.length > 0) {
    doc.font(FONT.regular).fontSize(TYPE.roomMeta).fillColor(INK);
    for (const extra of room.extras) {
      doc.text(`•  ${extra}`, LEFT + px(14), textY + px(2), { width: textWidth, lineGap: 1 });
      textY = doc.y;
    }
  }
  doc.font(FONT.bold).fontSize(TYPE.room).fillColor(INK).text(amount, LEFT + WIDTH - priceColumn(), y + 7, {
    width: priceColumn() - px(14),
    align: "right",
    lineBreak: false,
  });
  return y + height;
}

function paintBullets(doc: PDFKit.PDFDocument, title: string, items: string[], y: number): number {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) return y;
  const height = bulletHeight(doc, unique);
  y = ensure(doc, y, height);
  doc.rect(LEFT, y, WIDTH, height).fill(INCLUDED);
  doc.font(FONT.bold).fontSize(TYPE.includedTitle).fillColor(INK).text(title, LEFT + px(14), y + 7, {
    width: WIDTH - px(28),
  });
  let lineY = y + 7 + TYPE.includedTitle + 3;
  for (const item of unique) {
    doc.font(FONT.regular).fontSize(TYPE.included).fillColor(INK).text(`•  ${item}`, LEFT + px(14), lineY, {
      width: WIDTH - px(28),
      lineGap: 1,
    });
    lineY = doc.y + 1;
  }
  return y + height;
}

function paintTerms(doc: PDFKit.PDFDocument, lines: string[], y: number): number {
  if (lines.length === 0) return y;
  const height = termHeight(doc, lines);
  y = ensure(doc, y, height);
  doc.rect(LEFT, y, WIDTH, height).fill(SAND);
  let lineY = y + 7;
  for (const line of lines) {
    doc.font(FONT.italic).fontSize(TYPE.terms).fillColor(INK).text(line, LEFT + px(14), lineY, {
      width: WIDTH - px(28),
      lineGap: 1,
    });
    lineY = doc.y + 3;
  }
  return y + height;
}

function hotelTermLines(hotel: OptionsQuoteHotel): string[] {
  return printedTermLines(hotel);
}

function roomHeight(doc: PDFKit.PDFDocument, room: OptionsQuoteRoom, showInclusions: boolean): number {
  const textWidth = WIDTH - priceColumn() - px(20);
  doc.font(FONT.bold).fontSize(TYPE.room);
  const name = doc.heightOfString(room.name, { width: textWidth });
  doc.font(FONT.regular).fontSize(TYPE.roomMeta);
  const detail = room.detail ? doc.heightOfString(room.detail, { width: textWidth }) + 2 : 0;
  const included =
    showInclusions && room.inclusions.length > 0
      ? doc.heightOfString(room.inclusions.join("  ·  "), { width: textWidth }) + 4
      : 0;
  const extras = room.extras.reduce(
    (sum, item) => sum + doc.heightOfString(`•  ${item}`, { width: textWidth, lineGap: 1 }) + 4,
    0,
  );
  return Math.max(28, name + detail + included + extras + 14);
}

function bulletHeight(doc: PDFKit.PDFDocument, items: string[]): number {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;
  doc.font(FONT.regular).fontSize(TYPE.included);
  const body = unique.reduce(
    (sum, item) => sum + doc.heightOfString(`•  ${item}`, { width: WIDTH - px(28), lineGap: 1 }) + 1,
    0,
  );
  return body + 7 + TYPE.includedTitle + 3 + 8;
}

function termHeight(doc: PDFKit.PDFDocument, lines: string[]): number {
  if (lines.length === 0) return 0;
  doc.font(FONT.italic).fontSize(TYPE.terms);
  const body = lines.reduce(
    (sum, line) => sum + doc.heightOfString(line, { width: WIDTH - px(28), lineGap: 1 }) + 3,
    0,
  );
  return body + 11;
}

function paragraph(
  doc: PDFKit.PDFDocument,
  value: string,
  y: number,
  style: { size: number; font: string; color: string; lineGap?: number },
): number {
  doc.font(style.font).fontSize(style.size).fillColor(style.color).text(value, LEFT, y, {
    width: WIDTH,
    lineGap: style.lineGap ?? 0,
  });
  return doc.y + px(2);
}

function label(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width = 120) {
  doc.font(FONT.bold).fontSize(TYPE.label).fillColor(GOLD).text(value.toUpperCase(), x, y, {
    width,
    lineBreak: false,
    characterSpacing: 0.6,
  });
}

function priceColumn(): number {
  return 112;
}

function ensure(doc: PDFKit.PDFDocument, y: number, height: number): number {
  if (y + height <= PAGE_H - BOTTOM) return y;
  doc.addPage();
  return px(40);
}

function sharedCurrency(rooms: OptionsQuoteRoom[]): string | null {
  const codes = [...new Set(rooms.map((room) => room.currency).filter((code): code is string => Boolean(code)))];
  return codes.length === 1 ? codes[0]! : null;
}

function sharedList(lists: string[][]): boolean {
  if (lists.length === 0) return false;
  const first = JSON.stringify(lists[0] ?? []);
  return lists.every((list) => JSON.stringify(list) === first);
}
