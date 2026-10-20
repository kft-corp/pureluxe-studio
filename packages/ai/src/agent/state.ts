import { Annotation, MessagesAnnotation } from "@langchain/langgraph";

import type { TripFacts } from "../types";

import type { AgentAction } from "./types";

function replace<T>(_current: T, next: T): T {
  return next;
}

/**
 * What the trip agent remembers between steps (saved after each step).
 * Trip facts are reloaded at the start of every turn and after any change, so
 * the agent always sees saved values and never asks for them again.
 */
export const TripAgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  /** Fresh copy of the trip. */
  trip: Annotation<TripFacts | null>({ reducer: replace, default: () => null }),
  /** Set when this turn came from a button tap; cleared once the tap has run. */
  action: Annotation<AgentAction | null>({ reducer: replace, default: () => null }),
  /** Tool rounds used in this turn. Reset by every new turn. */
  toolRounds: Annotation<number>({ reducer: replace, default: () => 0 }),
  /** Ready-made reply for a simple tap (Undo): sent without calling the model. */
  quickReply: Annotation<string | null>({ reducer: replace, default: () => null }),
});

export type TripAgentStateValue = typeof TripAgentState.State;
export type TripAgentStateUpdate = typeof TripAgentState.Update;
