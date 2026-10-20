export type AgentTurnChannel = "trip" | "home";

export type AgentVersion = "v1" | "v2";

export type AgentTurnStatus = "ok" | "error" | "aborted";

/** One tool call inside an agent reply. Names and timings only. */
export type AgentTurnToolCall = {
  name: string;
  ms: number;
  ok: boolean;
  error_code: string | null;
};

/** Row from public.agent_turns. Metrics only — no message text or client data. */
export type AgentTurn = {
  id: string;
  trip_id: string | null;
  member_id: string | null;
  channel: AgentTurnChannel;
  agent_version: AgentVersion;
  thread_id: string | null;
  client_request_id: string | null;
  prompt_version: string | null;
  model: string;
  fallback_used: boolean;
  rounds: number;
  tool_calls: AgentTurnToolCall[];
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  ttft_ms: number | null;
  /** Request start → first model call. */
  prep_ms: number | null;
  /** Time inside model calls, summed across rounds. */
  model_ms: number | null;
  /** Request start → each preparation step, e.g. { access: 180, trip: 1300 }. */
  prep_steps: Record<string, number>;
  total_ms: number | null;
  status: AgentTurnStatus;
  error_code: string | null;
  created_at: string;
};
