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

/**
 * Host callbacks for the trip agent. Studio injects these, so @pureluxe/ai never
 * touches the database. Every handler checks the advisor's access and the trip's rules.
 */
export type TripAgentHandlers = DeskToolHandlers & {
  getTrip: () => Promise<TripFacts>;
  getPlaceNotes: (input: { query: string; cityHint?: string }) => Promise<PlaceNotes>;
  getRateSnapshot: () => Promise<RateSnapshot>;
  setClient: (input: { clientId: string; withHousehold: boolean }, call: ToolCallRef) => Promise<TripChange>;
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
