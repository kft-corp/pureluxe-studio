import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import {
  HOME_PROMPT_RULES,
  TRIP_PROMPT_V2_NO_MORE_TOOLS,
  TRIP_PROMPT_V2_RULES,
  buildHomeFacts,
  buildTripFactsV2,
} from "../prompts";
import type { TripFacts } from "../types";

import { CACHED } from "./model";

export type InstructionsInput = {
  trip: TripFacts | null;
  today: string;
  toolsExhausted: boolean;
};

/**
 * What the model is told on each call. The fixed rules come first (cached with the
 * tools before them); what changes between calls (date, trip facts, the lookup limit)
 * comes after the conversation, so a change never stops the conversation being cached.
 */
export type AgentInstructions = {
  rules: SystemMessage;
  context: HumanMessage;
};

function contextMessage(facts: string, toolsExhausted: boolean): HumanMessage {
  return new HumanMessage(
    [`[From Studio, not the advisor]`, facts, ...(toolsExhausted ? [TRIP_PROMPT_V2_NO_MORE_TOOLS] : [])].join("\n\n"),
  );
}

export function buildTripInstructions(input: InstructionsInput): AgentInstructions {
  return {
    rules: new SystemMessage({ content: [{ type: "text", text: TRIP_PROMPT_V2_RULES, cache_control: CACHED }] }),
    context: contextMessage(buildTripFactsV2(input.trip, input.today), input.toolsExhausted),
  };
}

/** The home chat: no trip, only today's date. */
export function buildHomeInstructions(input: InstructionsInput): AgentInstructions {
  return {
    rules: new SystemMessage({ content: [{ type: "text", text: HOME_PROMPT_RULES, cache_control: CACHED }] }),
    context: contextMessage(buildHomeFacts(input.today), input.toolsExhausted),
  };
}
