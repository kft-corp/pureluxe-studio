/** Work tabs follow the stored trip status. */
export const JOURNEY_WORK_STAGES = [
  "building",
  "quote_sent",
  "waiting_on_client",
  "booking",
] as const;

/** Travel tabs follow the trip dates. */
export const JOURNEY_TRAVEL_STAGES = ["upcoming", "on_trip", "past"] as const;

export const JOURNEY_PHASES = [
  "planning",
  "upcoming",
  "on_trip",
  "past",
  "cancelled",
] as const;

export type JourneyWorkStage = (typeof JOURNEY_WORK_STAGES)[number];
export type JourneyTravelStage = (typeof JOURNEY_TRAVEL_STAGES)[number];
export type JourneyPhase = (typeof JOURNEY_PHASES)[number];

const WORK_STAGES = new Set<string>(JOURNEY_WORK_STAGES);

export type JourneyClassification = {
  /** One word for the card: still planning, travelling, finished, or cancelled. */
  phase: JourneyPhase;
  /** Set while the trip status is still a planning status. */
  work: JourneyWorkStage | null;
  /** Set when the trip has a start and end date. */
  travel: JourneyTravelStage | null;
};

function asWorkStage(status: string): JourneyWorkStage | null {
  return WORK_STAGES.has(status) ? (status as JourneyWorkStage) : null;
}

/** Upcoming, on the trip, or past. Null when either date is missing. */
export function journeyTravelStage(
  startsOn: string | null,
  endsOn: string | null,
  today: string,
): JourneyTravelStage | null {
  if (!startsOn || !endsOn) return null;
  if (today < startsOn) return "upcoming";
  if (today > endsOn) return "past";
  return "on_trip";
}

/**
 * Card stage from status and dates.
 * A guest who is away today is on the trip even if the plan is still being built.
 * A completed trip stays in the past unless those dates say they are away today.
 */
export function classifyJourney(input: {
  status: string;
  startsOn: string | null;
  endsOn: string | null;
  today: string;
}): JourneyClassification {
  if (input.status === "cancelled") {
    return { phase: "cancelled", work: null, travel: null };
  }

  const travel = journeyTravelStage(input.startsOn, input.endsOn, input.today);
  const work = asWorkStage(input.status);

  if (travel === "on_trip") {
    return { phase: "on_trip", work, travel };
  }

  if (input.status === "completed" || travel === "past") {
    return { phase: "past", work: null, travel: "past" };
  }

  if (work) {
    return { phase: "planning", work, travel };
  }

  if (travel === "upcoming") {
    return { phase: "upcoming", work: null, travel };
  }

  return { phase: "planning", work: null, travel: null };
}

/** UTC calendar day, YYYY-MM-DD. Trip dates are stored the same way. */
export function journeyToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
