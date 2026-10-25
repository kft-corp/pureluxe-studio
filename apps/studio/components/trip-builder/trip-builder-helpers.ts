import type { NormalizedRateOption } from "@pureluxe/rates";

import type { TripDetail, TripStaySnapshot } from "@/lib/trip-builder";
import type { StayDraft } from "@/lib/trip-builder/intents";

import { partyFromTravellers, travellersConfirmed, tripStays } from "./stages";

/** The conversation column: the thread and the composer share one centred width. */
export const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-[44rem]";

/** A reply as plain text for the clipboard: no markdown symbols, bullets as "•", table rows as "a · b". */
export function plainReplyText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}[ \t]+/gm, "")
    .replace(/^>[ \t]?/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\|?[ \t]*:?-{2,}[-|: \t]*$/gm, "")
    .replace(/^\|(.*)\|[ \t]*$/gm, (_, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .join(" · "),
    )
    .replace(/^[ \t]*[-*][ \t]+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.includes("|", 1);
}

function isMarkdownTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("-")) return false;
  return /^\|?[\s:|-]+\|?$/.test(trimmed) && /:?-{2,}:?/.test(trimmed);
}

function splitMarkdownTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function joinMarkdownTableCells(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/**
 * Pad GFM tables so every row has the same column count.
 * Fixes agent tables with a missing blank header cell (hotels as columns)
 * or short rows that otherwise render misaligned in chat.
 */
export function normalizeMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i] ?? "";
    const sep = lines[i + 1] ?? "";
    if (!isMarkdownTableRow(header) || !isMarkdownTableSeparator(sep)) {
      out.push(header);
      i += 1;
      continue;
    }
    const start = i;
    i += 2;
    while (i < lines.length && isMarkdownTableRow(lines[i] ?? "")) i += 1;
    const block = lines.slice(start, i);
    const rows = block.map(splitMarkdownTableCells);
    const headerCells = rows[0] ?? [];
    const bodyRows = rows.slice(2);
    const bodyMax = bodyRows.reduce((max, row) => Math.max(max, row.length), 0);
    // Common compare shape: body has a label column the header omitted.
    if (bodyMax === headerCells.length + 1) {
      rows[0] = ["", ...headerCells];
    }
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    for (let r = 0; r < rows.length; r += 1) {
      const cells = [...(rows[r] ?? [])];
      while (cells.length < colCount) cells.push("");
      if (r === 1) {
        out.push(joinMarkdownTableCells(cells.map(() => "---")));
      } else {
        out.push(joinMarkdownTableCells(cells.slice(0, colCount)));
      }
    }
  }
  return out.join("\n");
}

/** The local calendar day of a message time, e.g. "2026-10-23". Null when it doesn't parse. */
export function chatDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, "0"))
    .join("-");
}

/** Day separator text: "Today", "Yesterday", "Mon 20 Oct", with the year when it isn't this year. */
export function chatDayLabel(iso: string, now: Date = new Date()): string {
  const key = chatDayKey(iso);
  if (key === chatDayKey(now.toISOString())) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === chatDayKey(yesterday.toISOString())) return "Yesterday";
  const date = new Date(iso);
  const weekday = date.toLocaleDateString("en-GB", { weekday: "short" });
  const dayMonth = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const year = date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${weekday} ${dayMonth}${year}`;
}

export type SavedRate = TripDetail["rates"]["candidates"][number];

export type ListedRate =
  | { title: string; kind: "search"; option: NormalizedRateOption }
  | { title: string; kind: "saved"; row: SavedRate };

export type OptionDraft = {
  title: string;
  currency: string | null;
  costLabel: string;
  /** Client price on the options quote. Null for search results and unpriced rooms. */
  sellLabel: string | null;
  option: NormalizedRateOption | null;
  lineItemId: string | null;
};

export type OptionCommit = OptionDraft & {
  mode: "add" | "price";
  amount: number | null;
};

export type CostUpdate = {
  lineItemId: string;
  room: string;
  amount: number;
  currency: string;
};

export type SellDraft = {
  sell_total: number;
  sell_currency: string;
};

export type OptionsTextEdit = {
  field: "title" | "notes";
  value: string;
};

export type PdfLineEdit = {
  id: string;
  label: string;
  before: string;
  after: string;
};

/** The one question waiting on yes or no. Its type picks the reply, the chips, and the no chip. */
export type Offer =
  | { type: "rate-search" }
  | { type: "paste"; text: string }
  | { type: "sell"; sell: SellDraft }
  | { type: "add-option"; commit: OptionCommit }
  | { type: "select-room"; room: OptionDraft }
  | { type: "options-text"; edit: OptionsTextEdit }
  | { type: "options-edit"; matches: PdfLineEdit[] }
  | { type: "options-preview" };

export function stayOn(
  detail: TripDetail | null,
  legId: string | null,
): TripStaySnapshot | null {
  const stays = tripStays(detail);
  return stays.find((stay) => stay.leg_id === legId) ?? stays[0] ?? null;
}

/** Search rows win. Saved trip rates show only when this session has no fresh search. */
export function listedRates(
  options: NormalizedRateOption[],
  saved: SavedRate[],
  legId: string | null,
): ListedRate[] {
  if (options.length > 0) {
    return options.slice(0, 6).map((option) => ({
      title: option.room_name || option.property_name || option.rate_source_code,
      kind: "search" as const,
      option,
    }));
  }
  return saved
    .filter((row) => !row.selected && (!legId || row.leg_id === legId))
    .slice(0, 6)
    .map((row) => ({
      title: row.title,
      kind: "saved" as const,
      row,
    }));
}

export function shortStayDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatMoney(amount: number | null, currency: string | null) {
  if (amount == null) return "";
  const code = currency?.trim().toUpperCase() || "";
  if (!code) {
    return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const figure = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return `${code} ${figure}`;
  }
}

export function stayFieldsDiffer(
  draft: StayDraft,
  stay: {
    property_name: string | null;
    city: string;
    check_in: string | null;
    check_out: string | null;
    adults: number | null;
    children: number | null;
    rooms: number | null;
  },
): boolean {
  return (
    draft.hotel.trim() !== (stay.property_name ?? "").trim() ||
    draft.city.trim() !== stay.city.trim() ||
    draft.checkIn !== (stay.check_in ?? "") ||
    draft.checkOut !== (stay.check_out ?? "") ||
    draft.adults !== stay.adults ||
    draft.children !== stay.children ||
    draft.rooms !== stay.rooms
  );
}

export function optionChipLabel(commit: OptionCommit): string {
  const room = commit.title.length > 32 ? `${commit.title.slice(0, 32).trim()}…` : commit.title;
  const money = formatMoney(commit.amount, commit.currency);
  if (commit.mode === "price") return money ? `Set price · ${room} · ${money}` : `Set price · ${room}`;
  return money ? `Add · ${room} · ${money}` : `Add · ${room} · price later`;
}

export const EMPTY_STAY: StayDraft = {
  hotel: "",
  city: "",
  checkIn: "",
  checkOut: "",
  adults: null,
  children: null,
  rooms: null,
};

/** The named travellers set the stay's party once the list is confirmed. */
export function withPartyCounts(draft: StayDraft, detail: TripDetail | null): StayDraft {
  if (!travellersConfirmed(detail)) return draft;
  const party = partyFromTravellers(detail);
  if (party.adults < 1) return draft;
  return { ...draft, adults: party.adults, children: party.children };
}

export function draftFromStay(stay: TripStaySnapshot | null): StayDraft {
  if (!stay) return EMPTY_STAY;
  return {
    hotel: stay.property_name ?? "",
    city: stay.city ?? "",
    checkIn: stay.check_in ?? "",
    checkOut: stay.check_out ?? "",
    adults: stay.adults,
    children: stay.children,
    rooms: stay.rooms,
  };
}
