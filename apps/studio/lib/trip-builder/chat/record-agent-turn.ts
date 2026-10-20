import { errorCodeOf, type TurnMeter } from "@pureluxe/ai";
import {
  insertAgentTurn,
  type AgentTurnChannel,
  type AgentTurnStatus,
  type AgentVersion,
} from "@pureluxe/db";

export type AgentTurnOutcome = {
  status: AgentTurnStatus;
  cause?: unknown;
};

type RecordAgentTurnInput = {
  meter: TurnMeter;
  outcome: AgentTurnOutcome;
  channel: AgentTurnChannel;
  tripId: string | null;
  memberId: string;
  clientRequestId: string | null;
  /** Defaults to v1. */
  agentVersion?: AgentVersion;
  /** LangGraph thread (trip:<id>) for v2. */
  threadId?: string | null;
  /** Instructions version that produced the reply. */
  promptVersion?: string | null;
};

/** Save one agent reply metrics row. Never throws — metrics must not break chat. */
export async function recordAgentTurn(input: RecordAgentTurnInput): Promise<void> {
  const metrics = input.meter.read();
  try {
    await insertAgentTurn({
      trip_id: input.tripId,
      member_id: input.memberId,
      channel: input.channel,
      agent_version: input.agentVersion ?? "v1",
      thread_id: input.threadId ?? null,
      client_request_id: input.clientRequestId,
      prompt_version: input.promptVersion ?? null,
      model: metrics.model ?? process.env.ANTHROPIC_MODEL?.trim() ?? "unknown",
      fallback_used: metrics.fallbackUsed,
      rounds: metrics.rounds,
      tool_calls: metrics.toolCalls,
      input_tokens: metrics.inputTokens,
      output_tokens: metrics.outputTokens,
      cache_read_tokens: metrics.cacheReadTokens,
      cache_write_tokens: metrics.cacheWriteTokens,
      ttft_ms: metrics.ttftMs,
      prep_ms: metrics.prepMs,
      model_ms: metrics.rounds > 0 ? metrics.modelMs : null,
      prep_steps: metrics.prepSteps,
      total_ms: metrics.totalMs,
      status: input.outcome.status,
      error_code: input.outcome.cause == null ? null : errorCodeOf(input.outcome.cause),
    });
  } catch (cause) {
    console.error("[agent_turns] insert failed:", errorCodeOf(cause));
  }
}
