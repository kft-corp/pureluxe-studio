import { buildPreTripSystemPrompt } from "../prompts";
import {
  PRE_TRIP_READ_TOOLS,
  streamAgentLoop,
  type AgentStreamChunk,
  type DeskToolHandlers,
  type TurnMeter,
} from "../tools";
import type { ChatHistoryMessage } from "../types";

import { buildModelMessages } from "./build-model-messages";

export type PreTripTurnInput = {
  message: string;
  history?: ChatHistoryMessage[];
  handlers: DeskToolHandlers;
  apiKey?: string;
  model?: string;
  /** Records tokens, rounds, tool timings, and time to first text. */
  meter?: TurnMeter;
};

/** Home chat turn — client, history, and hotel tools. Yields status + text chunks. */
export async function* streamPreTripTurn(
  input: PreTripTurnInput,
): AsyncGenerator<AgentStreamChunk, void, unknown> {
  yield* streamAgentLoop({
    system: buildPreTripSystemPrompt(),
    messages: buildModelMessages(input.history, input.message),
    handlers: input.handlers,
    toolSchemas: PRE_TRIP_READ_TOOLS,
    apiKey: input.apiKey,
    model: input.model,
    meter: input.meter,
  });
}
