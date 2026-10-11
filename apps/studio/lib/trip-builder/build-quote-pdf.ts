/**
 * Client quote PDF. Helvetica only — no PDF dependency.
 * Advisor cost is never drawn. The figure on the page is the client sell price.
 */

export type ClientQuoteStay = {
  hotel: string;
  city: string;
  dates: string;
  party: string;
  room: string;
  inclusions: string[];
};

export type ClientQuotePdf = {
  clientName: string;
  stays: ClientQuoteStay[];
  sell: string;
  intro: string | null;
  notes: string | null;
  highlights: string[];
};

const PAGE_W = 612;
const PAGE_H = 792;
const LEFT = 48;
const RIGHT = 564;
const FOREST = "0.102 0.302 0.243";
const INK = "0.12 0.12 0.12";
const MUTED = "0.38 0.36 0.32";
const CREAM = "0.980 0.976 0.969";
const WHITE = "1 1 1";

type Draw = string;

export function buildClientQuotePdf(quote: ClientQuotePdf): Uint8Array {
  const pages: Draw[][] = [[]];
  let y = 700;

  function page() {
    return pages[pages.length - 1]!;
  }

  function ensure(nextY: number) {
    if (nextY >= 56) return;
    pages.push([]);
    y = 740;
    text(page(), LEFT, y, 11, "F2", "PURELUXE", FOREST);
    y -= 22;
  }

  paintHeader(page());

  y = labelValue(page(), y, "PREPARED FOR", quote.clientName, 18);
  y -= 8;
  rule(page(), y);
  y -= 22;

  const stays = quote.stays.length > 0 ? quote.stays : [];
  stays.forEach((stay, index) => {
    ensure(y - 90);
    if (stays.length > 1) {
      text(page(), LEFT, y, 8, "F2", `STAY ${index + 1}`, FOREST);
      y -= 16;
    }
    text(page(), LEFT, y, 16, "F2", stay.hotel, INK);
    y -= 18;
    text(
      page(),
      LEFT,
      y,
      11,
      "F1",
      [stay.city, stay.dates].filter(Boolean).join("  ·  "),
      MUTED,
    );
    y -= 16;
    if (stay.party) {
      text(page(), LEFT, y, 11, "F1", stay.party, MUTED);
      y -= 18;
    } else {
      y -= 6;
    }
    y = labelValue(page(), y, "THE STAY", stay.room, 12);
    if (stay.inclusions.length > 0) {
      y = labelValue(page(), y, "INCLUDED", stay.inclusions.join("   ·   "), 11);
    }
    y -= 8;
  });

  ensure(y - 70);
  rect(page(), LEFT, y - 46, RIGHT - LEFT, 58, "0.910 0.949 0.933");
  text(page(), LEFT + 14, y - 8, 8, "F2", "YOUR QUOTE", FOREST);
  text(page(), LEFT + 14, y - 30, 16, "F2", quote.sell, FOREST);
  y -= 70;

  if (quote.intro) {
    y = paragraph(pages, y, "A NOTE", quote.intro);
  }
  if (quote.highlights.length > 0) {
    y = paragraph(pages, y, "HIGHLIGHTS", quote.highlights.map((item) => `•  ${item}`).join("\n"));
  }
  if (quote.notes) {
    y = paragraph(pages, y, "NOTES", quote.notes);
  }

  const last = pages[pages.length - 1]!;
  text(last, LEFT, 40, 8, "F1", "PureLuxe   ·   Private quote for the named guest", MUTED);

  return encode(pages);
}

function paintHeader(commands: Draw[]) {
  rect(commands, 0, 728, PAGE_W, 64, FOREST);
  text(commands, LEFT, 758, 16, "F2", "PURELUXE", WHITE);
  text(commands, LEFT, 740, 10, "F1", "Private travel quote", WHITE);
}

function labelValue(
  commands: Draw[],
  y: number,
  label: string,
  value: string,
  valueSize: number,
): number {
  text(commands, LEFT, y, 8, "F2", label, FOREST);
  y -= valueSize + 6;
  for (const line of wrap(value, valueSize >= 16 ? 42 : 78)) {
    text(commands, LEFT, y, valueSize, valueSize >= 14 ? "F2" : "F1", line, INK);
    y -= valueSize + 4;
  }
  return y - 8;
}

function paragraph(pages: Draw[][], y: number, label: string, body: string): number {
  const blocks = body.split("\n");
  let cursor = y;
  let started = false;
  for (const block of blocks) {
    const lines = wrap(block, 86);
    const chunk = lines.length === 0 ? [""] : lines;
    for (const line of chunk) {
      if (cursor < 72) {
        pages.push([]);
        cursor = 740;
        text(pages[pages.length - 1]!, LEFT, cursor, 11, "F2", "PURELUXE", FOREST);
        cursor -= 28;
        started = false;
      }
      const commands = pages[pages.length - 1]!;
      if (!started) {
        text(commands, LEFT, cursor, 8, "F2", label, FOREST);
        cursor -= 16;
        started = true;
      }
      text(commands, LEFT, cursor, 11, "F1", line, INK);
      cursor -= 15;
    }
  }
  return cursor - 8;
}

function wrap(value: string, width: number): string[] {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const words = clean.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function rect(commands: Draw[], x: number, y: number, w: number, h: number, color: string) {
  commands.push(`${color} rg`, `${x} ${y} ${w} ${h} re`, "f");
}

function text(
  commands: Draw[],
  x: number,
  y: number,
  size: number,
  font: "F1" | "F2",
  value: string,
  color: string,
) {
  const shown = escapePdfText(value);
  if (!shown) return;
  commands.push(
    "BT",
    `${color} rg`,
    `/${font} ${size} Tf`,
    `1 0 0 1 ${x} ${y} Tm`,
    `(${shown}) Tj`,
    "ET",
  );
}

function rule(commands: Draw[], y: number) {
  commands.push("0.84 0.82 0.78 RG", "0.6 w", `${LEFT} ${y} m ${RIGHT} ${y} l`, "S");
}

function encode(pages: Draw[][]): Uint8Array {
  const fontRegular = `${pages.length * 2 + 3} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n`;
  const fontBold = `${pages.length * 2 + 4} 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>endobj\n`;
  const fontRegularId = pages.length * 2 + 3;
  const fontBoldId = pages.length * 2 + 4;

  const objects: string[] = [
    `1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n`,
    "",
  ];

  const kids: string[] = [];
  pages.forEach((commands, index) => {
    const pageId = 3 + index * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const stream = [
      `${CREAM} rg`,
      `0 0 ${PAGE_W} ${PAGE_H} re`,
      "f",
      ...commands,
    ].join("\n");
    objects.push(
      `${pageId} 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> >>endobj\n`,
    );
    objects.push(
      `${contentId} 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
    );
  });

  objects[1] = `2 0 obj<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>endobj\n`;
  objects.push(fontRegular, fontBold);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }

  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "utf8"));
}

function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, " ");
}
