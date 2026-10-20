/** Phase 1 Trip Builder stages (matches Studio status strip). */
export const TRIP_BUILDER_STAGES = [
  "client",
  "stay",
  "rates",
  "quote",
  "booking",
] as const;

export type TripBuilderStage = (typeof TRIP_BUILDER_STAGES)[number];

export const TRIP_BUILDER_STAGE_LABELS: Record<TripBuilderStage, string> = {
  client: "Client",
  stay: "Stay",
  rates: "Rates",
  quote: "Quote",
  booking: "Booking",
};

/** One saved / selected accommodation rate (lean model fact). */
export type TripRateFact = {
  title: string;
  subtitle: string | null;
  cost_internal: number | null;
  currency: string | null;
  rate_source_code: string | null;
  selected: boolean;
  /** Client price for an options room. Null when not set. */
  sell_amount?: number | null;
  /** What this room includes. Empty when nothing is on file. */
  inclusions?: string[];
  /** Cancel rules stored on this rate. Null when none are on file. */
  cancellation_policy?: string | null;
  /** Payment rules stored on this rate. Null when none are on file. */
  payment_policy?: string | null;
};

/**
 * Lean trip facts for the model.
 * Studio maps TripDetail → this; @pureluxe/ai never imports Studio types.
 */
export type TripFacts = {
  trip_id: string;
  /** Bumped on every agent change; an approval shown for an older version is refused. */
  version?: number;
  title: string | null;
  status: string;
  pricing_locked: boolean;
  /** What the agent assumed rather than asked, e.g. ["year"]. Shown as editable. */
  assumptions?: string[];
  /** Stage shown in the Studio header. When set, the model uses it as is. */
  stage?: TripBuilderStage;
  /** Next step shown in the Studio header. When set, the model uses it as is. */
  next_step?: string;
  client: { id: string; display_name: string } | null;
  travellers_confirmed?: boolean;
  travellers?: Array<{ client_id?: string; display_name: string; role: string; party_role: string }>;
  family_suggestions?: Array<{
    client_id?: string;
    display_name: string;
    party_role: string;
    family_role: string;
  }>;
  starts_on?: string | null;
  ends_on?: string | null;
  legs_confirmed?: boolean;
  stay: {
    city: string;
    check_in: string | null;
    check_out: string | null;
    property_name: string | null;
  } | null;
  /** Every hotel stay. Empty when the trip has none yet. */
  stays?: Array<{
    city: string;
    check_in: string | null;
    check_out: string | null;
    property_name: string | null;
    rate_selected: boolean;
  }>;
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
  /** Advisor money view, already calculated. Strings are formatted with the currency. */
  price?: {
    hotel_net: string | null;
    tax: string | null;
    margin: string | null;
    margin_percent: string | null;
    client_price: string | null;
    /** Why a figure is missing, or how margin was worked out. */
    note: string | null;
  };
  /** Problems to fix before booking, already worked out (passport, visa, preferences, diet). */
  readiness?: string[];
};

/** Prior chat turns for the model (Studio maps DB rows → this). */
export type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

