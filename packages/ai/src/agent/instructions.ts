import { SystemMessage } from "@langchain/core/messages";

import {
  TRIP_PROMPT_V2_NO_MORE_TOOLS,
  TRIP_PROMPT_V2_RULES,
  buildTripFactsV2,
} from "../prompts";
import type { TripFacts } from "../types";

const CACHED = { type: "ephemeral" } as const;

/**
 * One instructions message, two parts (Claude accepts one system message):
 * fixed rules, then trip facts. Each part is a cache breakpoint, so the rules
 * (with the tools before them) are cached across trips, and the facts across turns.
 */
export function buildTripInstructions(input: {
  trip: TripFacts | null;
  today: string;
  toolsExhausted: boolean;
}): SystemMessage {
  return new SystemMessage({
    content: [
      { type: "text", text: TRIP_PROMPT_V2_RULES, cache_control: CACHED },
      { type: "text", text: buildTripFactsV2(input.trip, input.today), cache_control: CACHED },
      ...(input.toolsExhausted ? [{ type: "text", text: TRIP_PROMPT_V2_NO_MORE_TOOLS }] : []),
    ],
  });
}
