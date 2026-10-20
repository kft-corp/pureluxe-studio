import type { TripToolHandlers } from "../tools";

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

/**
 * Host callbacks for the trip agent. Studio injects these, so @pureluxe/ai never
 * touches the database. Every handler checks the advisor's access itself.
 */
export type TripAgentHandlers = TripToolHandlers & {
  getPlaceNotes: (input: { query: string; cityHint?: string }) => Promise<PlaceNotes>;
  getRateSnapshot: () => Promise<RateSnapshot>;
};

/** A button tap: run this tool directly, without reading any text. */
export type AgentAction = {
  tool: string;
  args: Record<string, unknown>;
  /** What the button said. Kept in agent memory as the advisor's turn. */
  label: string;
};

/** What started this turn. */
export type AgentTurnRequest =
  | { kind: "message"; text: string }
  | { kind: "action"; action: AgentAction }
  | { kind: "resume"; decision: "approve" | "cancel" };
