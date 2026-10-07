import type { TripToolHandlers } from "../tools";

/** Phase 1 Trip Builder stages (matches Studio status strip). */
export const TRIP_BUILDER_STAGES = [
  "client",
  "stay",
  "rates",
  "package",
  "quote",
] as const;

export type TripBuilderStage = (typeof TRIP_BUILDER_STAGES)[number];

export const TRIP_BUILDER_STAGE_LABELS: Record<TripBuilderStage, string> = {
  client: "Client",
  stay: "Stay",
  rates: "Rates",
  package: "Package",
  quote: "Quote",
};

/** One saved / selected accommodation rate (lean model fact). */
export type TripRateFact = {
  title: string;
  subtitle: string | null;
  cost_internal: number | null;
  currency: string | null;
  rate_source_code: string | null;
  selected: boolean;
};

/**
 * Lean trip facts for the model.
 * Studio maps TripDetail → this; @pureluxe/ai never imports Studio types.
 */
export type TripFacts = {
  trip_id: string;
  title: string | null;
  status: string;
  pricing_locked: boolean;
  client: { id: string; display_name: string } | null;
  stay: {
    city: string;
    check_in: string | null;
    check_out: string | null;
    property_name: string | null;
  } | null;
  rates: {
    selected: TripRateFact | null;
    /** Saved priced candidates (may be empty). */
    candidates: TripRateFact[];
  };
  quote: {
    title: string | null;
    intro: string | null;
    notes: string | null;
    highlights: string[];
    sell_total: number | null;
    sell_currency: string | null;
    document_status: string | null;
    has_file: boolean;
  };
};

/** Prior chat turns for the model (Studio maps DB rows → this). */
export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Input for one Studio Trip Builder chat turn. */
export type TripTurnInput = {
  tripId: string;
  memberId: string;
  message: string;
  trip: TripFacts;
  /** Prior studio messages (not including the current user message). */
  history?: ChatHistoryMessage[];
  /** Idempotent send key from the client. */
  clientRequestId?: string | null;
  /**
   * Host tool callbacks (get_trip, search_clients, get_client).
   * When omitted, turn is prompt + context only (no tool loop).
   */
  tools?: TripToolHandlers;
};

