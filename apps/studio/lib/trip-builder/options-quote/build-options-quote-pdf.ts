/**
 * Options quote PDF.
 * Letterhead, trip facts, advisor note (above hotels), then per hotel: room table
 * (Room | Meal plan | Occupancy when capacity differs | Total with currency symbol),
 * shared inclusions, room differences, getting there, good to know, then highlighted
 * Cancellation and Payment. Drawn with PDFKit. Reads OptionsQuoteDocument only.
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

  // Intro note above hotels so wording like "please find below" matches the layout.
  if (quote.notes?.trim()) {
    y = ensure(doc, y, px(56));
    y += 10;
    doc.moveTo(LEFT, y).lineTo(RIGHT, y).strokeColor(INK).lineWidth(0.6).stroke();
    y += 8;
    doc.font(FONT.bold).fontSize(TYPE.includedTitle).fillColor(INK).text("A note from your advisor", LEFT, y, {
      width: WIDTH,
    });
    y = paragraph(doc, quote.notes.trim(), doc.y + 4, {
      size: TYPE.notes,
      font: FONT.regular,
      color: INK,
      lineGap: px(4),
    });
  }

  for (const stay of quote.stays) y = paintStay(doc, stay, y + 14);
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
  const sharedIncluded = sharedInclusions(hotel.rooms);
  const roomDiffs = roomDifferenceLines(hotel, sharedIncluded);
  const gettingThere = [...hotel.arrival, ...hotel.transfers];
  const policies = hotelPolicySections(hotel);
  const cols = tableColumns(hotel.rooms);
  const block =
    58 +
    hotel.rooms.reduce((sum, room) => sum + roomHeight(doc, room, cols), 0) +
    bulletHeight(doc, sharedIncluded) +
    bulletHeight(doc, roomDiffs) +
    bulletHeight(doc, gettingThere) +
    bulletHeight(doc, hotel.shared) +
    importantHeight(doc, policies.cancellation) +
    importantHeight(doc, policies.payment);
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
  doc.text("Room", cols.roomX, headTextY, { width: cols.roomW, lineBreak: false });
  doc.text("Meal plan", cols.mealX, headTextY, { width: cols.mealW, lineBreak: false });
  if (cols.showSleeps) {
    doc.text("Occupancy", cols.sleepsX, headTextY, { width: cols.sleepsW, lineBreak: false });
  }
  doc.text("Total", cols.priceX, headTextY, {
    width: cols.priceW,
    align: "right",
    lineBreak: false,
  });
  y += headHeight;

  hotel.rooms.forEach((room, index) => {
    y = paintRoom(doc, room, y, index % 2 === 1, cols);
  });

  if (sharedIncluded.length > 0) {
    y = paintBullets(doc, "Included with every option", sharedIncluded, y);
  }
  if (roomDiffs.length > 0) {
    y = paintBullets(
      doc,
      sharedIncluded.length > 0 ? "Differences between rooms" : "What's included by room",
      roomDiffs,
      y,
    );
  }
  y = paintBullets(doc, "Getting there", gettingThere, y);
  y = paintBullets(doc, "Good to know", hotel.shared, y);
  y = paintImportant(doc, "Cancellation", policies.cancellation, y);
  y = paintImportant(doc, "Payment", policies.payment, y);
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
  shaded: boolean,
  cols: TableColumns,
): number {
  const height = roomHeight(doc, room, cols);
  y = ensure(doc, y, height);
  if (shaded) doc.rect(LEFT, y, WIDTH, height).fill(ROW);
  const amount = formatMoneyLabel(room.price, room.currency);
  const top = y + 7;
  doc.font(FONT.bold).fontSize(TYPE.room).fillColor(INK).text(room.name, cols.roomX, top, {
    width: cols.roomW,
  });
  doc.font(FONT.regular).fontSize(TYPE.roomMeta).fillColor(MUTED).text(room.detail?.trim() || "—", cols.mealX, top, {
    width: cols.mealW,
  });
  if (cols.showSleeps) {
    doc
      .font(FONT.regular)
      .fontSize(TYPE.roomMeta)
      .fillColor(MUTED)
      .text(room.sleeps?.trim() || "—", cols.sleepsX, top, { width: cols.sleepsW });
  }
  doc.font(FONT.bold).fontSize(TYPE.room).fillColor(INK).text(amount, cols.priceX, top, {
    width: cols.priceW,
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

/** Highlighted block for cancellation, payment, and other must-read terms. */
function paintImportant(doc: PDFKit.PDFDocument, title: string, items: string[], y: number): number {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) return y;
  const height = importantHeight(doc, unique);
  y = ensure(doc, y, height);
  doc.rect(LEFT, y, WIDTH, height).fill(SAND);
  doc.rect(LEFT, y, px(4), height).fill(GOLD);
  doc.font(FONT.bold).fontSize(TYPE.includedTitle).fillColor(INK).text(title, LEFT + px(14), y + 7, {
    width: WIDTH - px(28),
  });
  let lineY = y + 7 + TYPE.includedTitle + 3;
  for (const item of unique) {
    doc.font(FONT.regular).fontSize(TYPE.terms).fillColor(INK).text(`•  ${item}`, LEFT + px(14), lineY, {
      width: WIDTH - px(28),
      lineGap: 1,
    });
    lineY = doc.y + 2;
  }
  return y + height;
}

/**
 * Split cancel and payment for the client. A full terms rewrite on a room
 * is shown under Cancellation so payment is not duplicated.
 */
function hotelPolicySections(hotel: OptionsQuoteHotel): {
  cancellation: string[];
  payment: string[];
} {
  const cancelRows: Array<{ name: string; text: string }> = [];
  const paymentRows: Array<{ name: string; text: string }> = [];

  for (const room of hotel.rooms) {
    const override = room.terms?.trim() || null;
    if (override) {
      cancelRows.push({ name: room.name, text: override });
      continue;
    }
    if (room.cancellation?.trim()) {
      cancelRows.push({ name: room.name, text: room.cancellation.trim() });
    }
    if (room.payment?.trim()) {
      paymentRows.push({ name: room.name, text: room.payment.trim() });
    }
  }

  return {
    cancellation: policyLines(cancelRows, hotel.rooms.length),
    payment: policyLines(paymentRows, hotel.rooms.length),
  };
}

function policyLines(
  rows: Array<{ name: string; text: string }>,
  roomCount: number,
): string[] {
  if (rows.length === 0) return [];
  const same = rows.every((row) => row.text === rows[0]!.text);
  if (same) return [rows[0]!.text];
  if (roomCount <= 1) return rows.map((row) => row.text);
  return rows.map((row) => `${row.name}: ${row.text}`);
}

function roomHeight(doc: PDFKit.PDFDocument, room: OptionsQuoteRoom, cols: TableColumns): number {
  doc.font(FONT.bold).fontSize(TYPE.room);
  const name = doc.heightOfString(room.name, { width: cols.roomW });
  doc.font(FONT.regular).fontSize(TYPE.roomMeta);
  const meal = doc.heightOfString(room.detail?.trim() || "—", { width: cols.mealW });
  const sleeps = cols.showSleeps
    ? doc.heightOfString(room.sleeps?.trim() || "—", { width: cols.sleepsW })
    : 0;
  return Math.max(28, Math.max(name, meal, sleeps) + 14);
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

function importantHeight(doc: PDFKit.PDFDocument, items: string[]): number {
  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;
  doc.font(FONT.regular).fontSize(TYPE.terms);
  const body = unique.reduce(
    (sum, item) => sum + doc.heightOfString(`•  ${item}`, { width: WIDTH - px(28), lineGap: 1 }) + 2,
    0,
  );
  return body + 7 + TYPE.includedTitle + 3 + 8;
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

type TableColumns = {
  showSleeps: boolean;
  roomX: number;
  roomW: number;
  mealX: number;
  mealW: number;
  sleepsX: number;
  sleepsW: number;
  priceX: number;
  priceW: number;
};

/** Room | Meal plan | Total, plus Occupancy only when room capacity differs. */
function tableColumns(rooms: OptionsQuoteRoom[]): TableColumns {
  const pad = px(14);
  const gap = px(8);
  const priceW = px(108);
  const mealW = px(100);
  const showSleeps = showSleepsColumn(rooms);
  const sleepsW = showSleeps ? px(92) : 0;
  const priceX = LEFT + WIDTH - pad - priceW;
  const sleepsX = showSleeps ? priceX - gap - sleepsW : priceX;
  const mealX = sleepsX - gap - mealW;
  const roomX = LEFT + pad;
  const roomW = Math.max(px(80), mealX - gap - roomX);
  return { showSleeps, roomX, roomW, mealX, mealW, sleepsX, sleepsW, priceX, priceW };
}

/** Occupancy column only when two or more rooms list different capacity. */
function showSleepsColumn(rooms: OptionsQuoteRoom[]): boolean {
  if (rooms.length < 2) return false;
  return new Set(rooms.map((room) => room.sleeps?.trim() || "")).size > 1;
}

function ensure(doc: PDFKit.PDFDocument, y: number, height: number): number {
  if (y + height <= PAGE_H - BOTTOM) return y;
  doc.addPage();
  return px(40);
}

/** Lines true for every room option at this hotel. */
function sharedInclusions(rooms: OptionsQuoteRoom[]): string[] {
  if (rooms.length === 0) return [];
  const [first, ...rest] = rooms;
  return distinctLines(first?.inclusions ?? []).filter((item) =>
    rest.every((room) => room.inclusions.includes(item)),
  );
}

/** Room-only inclusions and extras, one client line per room that differs. */
function roomDifferenceLines(hotel: OptionsQuoteHotel, shared: string[]): string[] {
  const sharedSet = new Set(shared);
  const lines: string[] = [];
  for (const room of hotel.rooms) {
    const only = distinctLines([
      ...room.inclusions.filter((item) => !sharedSet.has(item)),
      ...room.extras,
    ]);
    if (only.length === 0) continue;
    lines.push(`${room.name}: ${only.join("; ")}`);
  }
  return lines;
}

function distinctLines(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

/** Client price with a currency symbol when the ISO code is known. */
function formatMoneyLabel(amountText: string, currency: string | null): string {
  const trimmed = amountText.trim();
  if (!trimmed || /^to be confirmed$/i.test(trimmed)) return trimmed || "To be confirmed";
  const code = currency?.trim().toUpperCase() || null;
  const amount = Number(trimmed.replace(/,/g, ""));
  if (!code || !Number.isFinite(amount)) {
    return code ? `${code} ${trimmed}` : trimmed;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "symbol",
      minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${trimmed}`;
  }
}
