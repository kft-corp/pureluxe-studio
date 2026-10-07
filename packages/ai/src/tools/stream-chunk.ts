/** Lightweight phases for chat UI (Phase 1). */
export type AgentPhase = "thinking" | "looking_up" | "writing";

/** One piece of a streaming agent turn. */
export type AgentStreamChunk =
  | { kind: "status"; phase: AgentPhase }
  | { kind: "delta"; text: string };

export const AGENT_PHASE_LABEL: Record<AgentPhase, string> = {
  thinking: "Thinking…",
  looking_up: "Looking up…",
  writing: "Writing…",
};
