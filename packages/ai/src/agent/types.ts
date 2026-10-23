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
      hotel: string | null;
      check_in: string | null;
      check_out: string | null;
      room_count: number;
      /** Filtered rooms and the hotel rules for these dates. Team cost is advisor-only. */
      notes: string;
    };

/** Result of a trip change. Rule and access errors are thrown as AppErrors. */
export type TripChange = {
  ok: true;
  summary: string;
  /** True when Undo is offered. */
  undo: boolean;
  /** Nothing needed to change (or the same call already ran). */
  unchanged?: true;
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
