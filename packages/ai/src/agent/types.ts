import type { DeskToolHandlers } from "../tools";
import type { TripFacts } from "../types";

/**
 * How risky a tool is.
 * read: looks things up · undo: changes the trip and shows Undo · approval: asks first.
 */
export type AgentToolRisk = "read" | "undo" | "approval";

/** Atlas notes for a country, city or hotel. */
export type PlaceNotes = {
  matched: boolean;
  /** Plain-language notes. Null when PureLuxe has none for that name. */
  notes: string | null;
  hotels: Array<{ name: string; city: string; contracted: boolean | null }>;
};

/** The last rate search on this trip, for follow-up questions. */
export type RateSnapshot =
  | { status: "none" }
  | {
      status: "found";
      searched_at: string;
      /** Primary hotel name, or null when several hotels were searched. */
      hotel: string | null;
      /** All hotels in the last search (Stage 3c). */
      hotels: string[];
      check_in: string | null;
      check_out: string | null;
      adults: number | null;
      children: number | null;
      rooms: number | null;
      room_count: number;
      /** Filtered rooms and the hotel rules for these dates. Team cost is advisor-only. */
      notes: string;
    };

/** One hotel named in rates_search. */
export type RatesSearchHotelInput = {
  name: string;
};

/** Input for multi-hotel rates_search (no saved stay required). */
export type RatesSearchInput = {
  destination: string;
  hotels: string[];
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
};

/** One room/hotel to put on the options quote. */
export type QuoteOptionRequest = {
  hotel: string;
  room: string;
  /** Markup percent, e.g. 25. Mutually exclusive with clientPrice when both set: clientPrice wins. */
  markupPercent?: number;
  /** Absolute client price as the advisor gave it. */
  clientPrice?: number;
  currency?: string;
  /** Option order within the hotel (1 = first). */
  rank?: number;
  /** rate_search_results.id from the last search when known. */
  rateRef?: string;
};

export type QuoteAddOptionsInput = {
  options: QuoteOptionRequest[];
};

export type QuoteSetClientPriceInput = {
  prices: Array<{ hotel: string; room: string; clientPrice: number; currency?: string }>;
};

export type QuoteRemoveOptionInput = {
  /** One room (legacy single-remove). Prefer `options` or `clearAll`. */
  hotel?: string;
  room?: string;
  /** Several rooms to drop in one call. */
  options?: Array<{ hotel: string; room: string }>;
  /** Drop every room on the options quote. */
  clearAll?: boolean;
};

export type QuoteSetWordingInput = {
  title?: string;
  notes?: string;
};

/** Rewrite one or more printable lines on the options quote PDF. */
export type QuoteEditLinesInput = {
  /** Set full new text for known line ids from quote_list_lines. */
  lines?: Array<{ id: string; text: string }>;
  /** Replace these words wherever they appear on the PDF (case-insensitive). */
  find?: string;
  replace?: string;
};

/** Expand supplier shorthand on a quote section into client plain English. */
export type QuoteRewriteSectionInput = {
  section:
    | "inclusions"
    | "board"
    | "transfers"
    | "arrival"
    | "shared"
    | "terms"
    | "notice"
    | "client_wording";
  hotel?: string;
  room?: string;
};

/** One printable line on the options quote (header and footer excluded). */
export type QuotePdfLine = {
  id: string;
  label: string;
  text: string;
};

export type QuoteListLinesResult = {
  lines: QuotePdfLine[];
};

/** Open or rebuild the options quote PDF for the advisor. */
export type QuotePreviewInput = {
  /** Rebuild even when the current file matches the trip. */
  force?: boolean;
};

export type QuotePreviewResult = {
  ok: true;
  summary: string;
  /** Short-lived signed URL; the browser opens it from the stream. */
  url: string;
  expires_in: number;
};

export type RatesUsePastedQuoteInput = {
  hotel: string;
  room: string;
  pasteText: string;
  clientPrice?: number;
  currency?: string;
};

/** Result of a trip change. Rule and access errors are thrown as AppErrors. */
export type TripChange = {
  ok: true;
  summary: string;
  /** True when Undo is offered. */
  undo: boolean;
  /** Nothing needed to change (or the same call already ran). */
  unchanged?: true;
  /**
   * Options quote PDF URL after a wording/price change rebuilt the file.
   * The browser opens it from the stream (same as quote_preview).
   */
  url?: string;
};

/** The tool call behind a change: its id makes a retry or resume safe. */
export type ToolCallRef = { id: string };

export type PartyRole = "adult" | "child";

export type StayRequest = {
  city: string;
  /** YYYY-MM-DD or MM-DD. Omit both for a single stay covering the whole trip. */
  checkIn?: string;
  checkOut?: string;
  /** Hotel name; null clears it, omitted keeps the current one. */
  hotel?: string | null;
  rooms?: number;
};

/** Who leads: the client named, or (for "the Mehta family") the household's primary member. */
export type LeadChoice = "named" | "household_primary";

/**
 * Lookups both chats have: clients, history, hotels and place notes. All handlers are
 * host callbacks Studio injects, so @pureluxe/ai never touches the database; every
 * handler checks the advisor's access and the trip's rules.
 */
export type DeskAgentHandlers = DeskToolHandlers & {
  getPlaceNotes: (input: { query: string; cityHint?: string }) => Promise<PlaceNotes>;
};

/** The trip chat: lookups plus changes to the open trip. */
export type TripAgentHandlers = DeskAgentHandlers & {
  getTrip: () => Promise<TripFacts>;
  getRateSnapshot: () => Promise<RateSnapshot>;
  /** Multi-hotel rate search; no saved stay required (Stage 3c). */
  searchRates: (input: RatesSearchInput) => Promise<unknown>;
  setClient: (
    input: { clientId: string; withHousehold: boolean; lead: LeadChoice },
    call: ToolCallRef,
  ) => Promise<TripChange>;
  setTravellers: (
    input: { add: Array<{ clientId: string; partyRole: PartyRole }>; remove: string[] },
    call: ToolCallRef,
  ) => Promise<TripChange>;
  setDates: (input: { start: string; end: string }, call: ToolCallRef) => Promise<TripChange>;
  setStays: (input: { stays: StayRequest[]; start?: string; end?: string }, call: ToolCallRef) => Promise<TripChange>;
  removeStay: (input: { city: string }, call: ToolCallRef) => Promise<TripChange>;
  shiftDates: (input: { days: number }, call: ToolCallRef) => Promise<TripChange>;
  undo: (call: ToolCallRef) => Promise<TripChange>;
  addQuoteOptions: (input: QuoteAddOptionsInput, call: ToolCallRef) => Promise<TripChange>;
  setQuoteClientPrices: (input: QuoteSetClientPriceInput, call: ToolCallRef) => Promise<TripChange>;
  removeQuoteOption: (input: QuoteRemoveOptionInput, call: ToolCallRef) => Promise<TripChange>;
  setQuoteWording: (input: QuoteSetWordingInput, call: ToolCallRef) => Promise<TripChange>;
  editQuoteLines: (input: QuoteEditLinesInput, call: ToolCallRef) => Promise<TripChange>;
  rewriteQuoteSection: (input: QuoteRewriteSectionInput, call: ToolCallRef) => Promise<TripChange>;
  listQuoteLines: () => Promise<QuoteListLinesResult>;
  previewQuote: (input: QuotePreviewInput) => Promise<QuotePreviewResult>;
  usePastedQuote: (input: RatesUsePastedQuoteInput, call: ToolCallRef) => Promise<TripChange>;
  sendQuote: (call: ToolCallRef) => Promise<TripChange>;
};

/** A trip the home chat asks Studio to create, with everything the advisor said. */
export type TripCreateRequest = {
  /** Omitted when the advisor named no client. */
  clientId?: string;
  lead: LeadChoice;
  withHousehold: boolean;
  /** YYYY-MM-DD or MM-DD. */
  start?: string;
  end?: string;
  stays: StayRequest[];
  /** The advisor saw the client's upcoming trips and still wants a new one. */
  createAnyway: boolean;
};

/** An upcoming trip of someone travelling, which may be the one the advisor means. Snake case: the model reads it. */
export type UpcomingTripMatch = {
  trip_id: string;
  title: string | null;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  destinations: string[];
  /** Null for the advisor's own trip (it can be opened); otherwise the advisor who owns it. */
  owner_name: string | null;
  /** "dates": overlaps the new dates. "destination": the same place. Null: another upcoming trip. */
  matches: "dates" | "destination" | null;
};

export type TripCreateResult =
  | { ok: true; status: "created"; trip_id: string; summary: string; unchanged?: true }
  | { ok: true; status: "existing"; upcoming_trips: UpcomingTripMatch[] };

/** The home chat (no trip open): lookups, creating a trip, and opening one. */
export type HomeAgentHandlers = DeskAgentHandlers & {
  createTrip: (input: TripCreateRequest, call: ToolCallRef) => Promise<TripCreateResult>;
  openTrip: (input: { tripId: string }) => Promise<{ ok: true; trip_id: string; title: string | null }>;
};

/** A button tap: run this tool directly, without reading any text. */
export type AgentAction = {
  tool: string;
  args: Record<string, unknown>;
  /** What the button said. Kept in agent memory as the advisor's turn. */
  label: string;
};

/** How an approval card was answered. `expired`: it timed out or the trip changed. */
export type ApprovalDecision = "approve" | "cancel" | "expired";

/** What started this turn. */
export type AgentTurnRequest =
  | { kind: "message"; text: string }
  | { kind: "action"; action: AgentAction }
  | { kind: "resume"; decision: ApprovalDecision };
