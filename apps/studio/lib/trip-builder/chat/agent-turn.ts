import {
  getAgentCheckpointer,
  streamTripAgentTurn,
  type AgentStreamChunk,
  type AgentTurnRequest,
  type TripAgentHandlers,
  type TripFacts,
  type TurnMeter,
} from "@pureluxe/ai";
import { getPgPool } from "@pureluxe/db/pg";
import { journeyToday } from "@pureluxe/shared";

import { createTripAgentTools } from "@/lib/ai";

import { loadChatHistory } from "./chat-history";

/** Earlier chat rows used to start memory for a trip the agent hasn't seen. */
const SEED_ROWS = 24;

type ChatActor = { memberId: string; permissions: readonly string[] };

/** What a turn needs before the advisor's message is saved. */
export type AgentPrefetch = {
  handlers: TripAgentHandlers;
  /** Started right after the access check, so it overlaps with the lock and saving. */
  trip: Promise<TripFacts>;
};

/** Start loading the trip facts now. A failure surfaces when the agent awaits them. */
export function prefetchAgentTurn(tripId: string, actor: ChatActor): AgentPrefetch {
  const handlers = createTripAgentTools({
    tripId,
    memberId: actor.memberId,
    permissions: actor.permissions,
  });
  const trip = handlers.getTrip();
  trip.catch(() => {});
  return { handlers, trip };
}

/**
 * One agent turn (LangGraph): Claude picks the tools; a button tap runs its tool directly.
 * Progress is saved in Postgres, so a retried send continues where it stopped.
 */
export async function* streamAgentTurn(input: {
  tripId: string;
  request: AgentTurnRequest;
  /** Advisor row of this turn, left out of the seeded history. */
  userRowId: string;
  prefetch: AgentPrefetch;
  meter: TurnMeter;
  /** This send key was seen before and its reply did not finish. */
  retry: boolean;
  signal: AbortSignal;
}): AsyncGenerator<AgentStreamChunk, void, unknown> {
  const { tripId, prefetch } = input;
  const checkpointer = await getAgentCheckpointer(getPgPool());

  yield* streamTripAgentTurn({
    tripId,
    request: input.request,
    handlers: prefetch.handlers,
    checkpointer,
    today: journeyToday(),
    trip: prefetch.trip,
    loadHistory: () => loadChatHistory(tripId, { limit: SEED_ROWS, excludeId: input.userRowId }),
    retry: input.retry,
    meter: input.meter,
    signal: input.signal,
  });
}
