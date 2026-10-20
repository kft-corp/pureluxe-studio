import { getServiceClient, runSupabaseQuery } from "../../client";
import { dbQueryError } from "../../errors";
import type {
  AgentTurnChannel,
  AgentTurnStatus,
  AgentTurnToolCall,
  AgentVersion,
} from "../../schema";

export type InsertAgentTurnInput = {
  trip_id: string | null;
  member_id: string | null;
  channel: AgentTurnChannel;
  agent_version: AgentVersion;
  thread_id?: string | null;
  client_request_id?: string | null;
  prompt_version?: string | null;
  model: string;
  fallback_used?: boolean;
  rounds: number;
  tool_calls: AgentTurnToolCall[];
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  ttft_ms: number | null;
  prep_ms?: number | null;
  model_ms?: number | null;
  prep_steps?: Record<string, number>;
  total_ms: number | null;
  status: AgentTurnStatus;
  error_code?: string | null;
};

/** Insert one agent reply metrics row. */
export async function insertAgentTurn(input: InsertAgentTurnInput): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await runSupabaseQuery(() =>
    supabase.from("agent_turns").insert({
      trip_id: input.trip_id,
      member_id: input.member_id,
      channel: input.channel,
      agent_version: input.agent_version,
      thread_id: input.thread_id ?? null,
      client_request_id: input.client_request_id ?? null,
      prompt_version: input.prompt_version ?? null,
      model: input.model,
      fallback_used: input.fallback_used ?? false,
      rounds: input.rounds,
      tool_calls: input.tool_calls,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
      cache_read_tokens: input.cache_read_tokens,
      cache_write_tokens: input.cache_write_tokens,
      ttft_ms: input.ttft_ms,
      prep_ms: input.prep_ms ?? null,
      model_ms: input.model_ms ?? null,
      prep_steps: input.prep_steps ?? {},
      total_ms: input.total_ms,
      status: input.status,
      error_code: input.error_code ?? null,
    }),
  );

  if (error) {
    throw dbQueryError(error);
  }
}
