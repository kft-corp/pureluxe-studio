/**
 * Golden test conversations for the Trip Builder agent (redesign §10).
 *
 * A scenario is a scripted advisor conversation plus what must be true after
 * each step. The eval runner (`npm run eval:agent`, Stage 1) replays it
 * against the real model on seeded data. Each step names the build stage that
 * makes it checkable, so the runner skips steps the agent can't do yet.
 *
 * Expectations describe outcomes (trip state, cards, tool use, reply rules),
 * not exact wording — the model may phrase replies its own way.
 */

/** Ideal-flow stage from Keshav's redesign (1 client … 7 pre-arrival). */
export type FlowStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Build stage from the redesign's order of work that makes a step checkable. */
export type BuildStage = "stage-1" | "stage-2" | "stage-3" | "stage-5";

/** Agent v2 tool names (redesign §4.3). */
export type AgentToolName =
  | "trip_get"
  | "client_search"
  | "client_get"
  | "history_search_trips"
  | "history_search_bookings"
  | "history_get_booking"
  | "hotel_find"
  | "hotel_get"
  | "place_get_notes"
  | "rates_search"
  | "rates_get_snapshot"
  | "trip_set_client"
  | "trip_set_travellers"
  | "trip_set_dates"
  | "trip_set_stays"
  | "quote_add_options"
  | "quote_remove_option"
  | "quote_set_wording"
  | "quote_set_client_price"
  | "rates_use_pasted_quote"
  | "trip_undo"
  | "trip_shift_dates"
  | "trip_remove_stay"
  | "quote_select_final"
  | "quote_send";

export type CardKind = "client_picker" | "rate_compare" | "leg_split" | "undo" | "approval";

/** What the advisor does in one step. */
export type AdvisorInput =
  /** Typed message. Each variant must reach the same outcome. */
  | { kind: "say"; text: string; variants?: string[] }
  /** Button or card tap. Sent as a structured action, never as text. */
  | { kind: "tap"; label: string; action: AgentToolName | "approve" | "cancel"; args?: Record<string, unknown> }
  /** Something that happens outside the chat (client app, Bookings module). */
  | { kind: "event"; event: "client_selected_option" | "booking_confirmed"; args: Record<string, unknown> }
  /** No input — only check what the system did on its own. */
  | { kind: "check" };

export type TripExpectation = {
  client?: { lead: string; travellers: string[]; adults: number; children: number };
  dates?: { start: string; end: string; assumed?: Array<"year" | "rooms"> };
  stays?: Array<{ destination: string; checkIn: string; checkOut: string }>;
  quoteOptions?: {
    count: number;
    includes?: Array<{ hotel: string; room: string; rank?: number; markupPercent?: number }>;
  };
  quoteStatus?: "draft" | "sent";
  chosenOption?: { hotel: string; room: string };
  booking?: { hotel: string; status: "pending" | "confirmed" };
  preArrival?: { started: boolean; prefilled: Array<"travellers" | "dates" | "stays" | "preferences"> };
};

export type StepExpect = {
  tools?: {
    /** Each must be called at least once in this step. */
    called?: AgentToolName[];
    /** None of these may be called in this step. */
    notCalled?: AgentToolName[];
    /** Max number of calls of one tool (e.g. one batched quote_add_options). */
    maxCalls?: Partial<Record<AgentToolName, number>>;
  };
  /** Trip state after the step (partial match). */
  trip?: TripExpectation;
  /** Cards shown with the reply. */
  cards?: CardKind[];
  rateCompare?: { hotels?: string[]; minHotels?: number; excludesHotels?: string[] };
  reply?: {
    /** Words or values the reply must include (case-insensitive). */
    mentions?: string[];
    /** The reply must not include any of these. */
    mustNot?: string[];
    /** The reply ends by asking the advisor something. */
    asksQuestion?: boolean;
  };
  /** Yes/no prompts allowed in this step. Default 0. */
  confirmations?: number;
  /** Approval cards allowed in this step. Default 0. */
  approvals?: number;
  /** No write tool may run (pure question). */
  readOnly?: boolean;
  /** Text that must never be saved in agent memory (passport numbers, bank details). */
  memoryMustNot?: string[];
};

export type ScenarioStep = {
  id: string;
  /** Ideal-flow stages this step covers. */
  flowStages: FlowStage[];
  buildStage: BuildStage;
  title: string;
  advisor: AdvisorInput;
  expect: StepExpect;
  note?: string;
};

/** A question asked mid-flow. Must be answered without changing the trip. */
export type Interruption = {
  id: string;
  /** Asked right after this step. */
  afterStep: string;
  buildStage: BuildStage;
  advisor: Extract<AdvisorInput, { kind: "say" }>;
  expect: StepExpect & { readOnly: true };
  note?: string;
};

export type ScenarioBudget = {
  /** Typed messages + taps from the first step until the quote is sent. */
  maxAdvisorInputsToQuoteSent: number;
  maxConfirmationsTotal: number;
  /** Approvals before the quote is sent (button taps count as approval). */
  maxApprovalsToQuoteSent: number;
};

export type AgentScenario = {
  id: string;
  title: string;
  /** Frozen "today" for date assumptions. */
  now: string;
  advisorMemberId: string;
  steps: ScenarioStep[];
  interruptions?: Interruption[];
  budget: ScenarioBudget;
  /** Rules checked on every reply in the scenario. */
  everyReply: { mustNot: string[] };
};

// ---------------------------------------------------------------------------
// Seed data shapes (inserted into a test database or served by mock handlers)
// ---------------------------------------------------------------------------

export type SeedClient = {
  id: string;
  displayName: string;
  email: string;
  tier: string;
  household?: Array<{ clientId: string; relation: "spouse" | "child" | "parent" | "sibling" }>;
  /** Date of birth for adult/child counts. */
  dateOfBirth: string;
};

export type SeedRoom = {
  name: string;
  /** Team cost per night, USD, for the seeded dates. */
  nightlyCost: number;
  maxAdults: number;
  inclusions: string[];
};

export type SeedHotel = {
  propertyId: string;
  name: string;
  aliases?: string[];
  destination: string;
  styleTags: string[];
  minMarkupPercent: number;
  cancellation: string;
  /** Required charges the all-in price must add (R2). */
  requiredCharges: Array<{ name: string; amount: number; unit: "per_person" | "per_person_per_night" }>;
  rooms: SeedRoom[];
  /** Covered dates for the contracted rate. */
  validFrom: string;
  validTo: string;
};

/** Atlas notes for a country or city. Hotels in that destination are listed with them. */
export type SeedPlace = {
  name: string;
  kind: "country" | "city";
  notes: string;
};

export type ScenarioSeed = {
  advisor: { memberId: string; name: string };
  clients: SeedClient[];
  hotels: SeedHotel[];
  places?: SeedPlace[];
};
