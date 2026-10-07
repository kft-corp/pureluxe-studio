import { buildTripContext, resolveTripStage } from "../context";
import { buildSystemPrompt } from "../prompts";
import { streamClaudeText } from "../providers";
import {
  TRIP_BUILDER_READ_TOOLS,
  streamAgentLoop,
  type AgentStreamChunk,
} from "../tools";
import type { TripBuilderStage, TripTurnInput } from "../types";

import { buildModelMessages } from "./build-model-messages";

function prepareTurn(input: TripTurnInput) {
  const stage = resolveTripStage(input.trip);
  const tripContext = buildTripContext(input.trip);
  const hasTools = Boolean(input.tools);
  const system = buildSystemPrompt({
    stage,
    tripContext,
    toolsEnabled: hasTools,
  });
  const messages = buildModelMessages(input.history, input.message);
  return { stage, system, messages, hasTools };
}

/** One trip chat turn — yields status + text chunks. */
export async function* streamTripTurn(
  input: TripTurnInput,
): AsyncGenerator<AgentStreamChunk, TripBuilderStage, unknown> {
  const { stage, system, messages, hasTools } = prepareTurn(input);

  if (hasTools && input.tools) {
    yield* streamAgentLoop({
      system,
      messages,
      handlers: input.tools,
      toolSchemas: TRIP_BUILDER_READ_TOOLS,
    });
    return stage;
  }

  yield { kind: "status", phase: "thinking" };
  let firstDelta = true;
  for await (const text of streamClaudeText({ system, messages })) {
    if (firstDelta) {
      yield { kind: "status", phase: "writing" };
      firstDelta = false;
    }
    yield { kind: "delta", text };
  }
  return stage;
}
