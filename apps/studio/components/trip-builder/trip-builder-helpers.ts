import type { NormalizedRateOption } from "@pureluxe/rates";

import type { TripDetail, TripStaySnapshot } from "@/lib/trip-builder";
import type { StayDraft } from "@/lib/trip-builder/intents";

import { partyFromTravellers, travellersConfirmed, tripStays } from "./stages";

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
  const code = currency?.trim() || "";
  const figure = amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return code ? `${code} ${figure}` : figure;
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
