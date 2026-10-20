import {
  getAgentCheckpointer,
  streamTripAgentTurn,
  type AgentStreamChunk,
  type TripAgentHandlers,
  type TripFacts,
  type TurnMeter,
} from "@pureluxe/ai";
import type { TripChatMessage } from "@pureluxe/db";
import { getPgPool } from "@pureluxe/db/pg";
import { journeyToday } from "@pureluxe/shared";

import { createTripAgentTools } from "@/lib/ai";

import { loadChatHistory } from "./chat-history";
import { agentRequestFromRow } from "./chat-turn-request";

/** Earlier chat rows used to start memory for a trip the new agent hasn't seen. */
const SEED_ROWS = 24;

type ChatActor = { memberId: string; permissions: readonly string[] };

/** What a v2 turn needs before the advisor's message is saved. */
export type AgentV2Prefetch = {
  handlers: TripAgentHandlers;
  /** Started right after the access check, so it overlaps with the lock and saving. */
  trip: Promise<TripFacts>;
};

/** Start loading the trip facts now. A failure surfaces when the agent awaits them. */
export function prefetchAgentV2(tripId: string, actor: ChatActor): AgentV2Prefetch {
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
 * Agent v2 (LangGraph): Claude picks the tools; a button tap runs its tool directly.
 * Progress is saved in Postgres, so a retried send continues where it stopped.
 */
export async function* streamAgentV2Turn(input: {
  tripId: string;
  userRow: TripChatMessage;
  prefetch: AgentV2Prefetch;
  meter: TurnMeter;
  /** This send key was seen before and its reply did not finish. */
  retry: boolean;
  signal: AbortSignal;
}): AsyncGenerator<AgentStreamChunk, void, unknown> {
  const { tripId, userRow, prefetch } = input;
  const checkpointer = await getAgentCheckpointer(getPgPool());

  yield* streamTripAgentTurn({
    tripId,
    request: agentRequestFromRow(userRow),
    handlers: prefetch.handlers,
    checkpointer,
    today: journeyToday(),
    trip: prefetch.trip,
    loadHistory: () => loadChatHistory(tripId, { limit: SEED_ROWS, excludeId: userRow.id }),
    retry: input.retry,
    meter: input.meter,
    signal: input.signal,
  });
}
