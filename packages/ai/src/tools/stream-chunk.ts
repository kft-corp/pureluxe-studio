/**
 * Chat stream shapes, safe to import in the browser via "@pureluxe/ai/chat-stream"
 * (the package root also loads the agent runtime). Keep this file dependency-free.
 */

/** Lightweight phases for chat UI (Phase 1). */
export type AgentPhase = "thinking" | "looking_up" | "writing";

/** One piece of a streaming agent turn. */
export type AgentStreamChunk =
  | { kind: "status"; phase: AgentPhase }
  /** What the agent is doing right now, e.g. "Searching clients…". */
  | { kind: "progress"; label: string }
  | { kind: "delta"; text: string };

export const AGENT_PHASE_LABEL: Record<AgentPhase, string> = {
  thinking: "Thinking…",
  looking_up: "Looking up…",
  writing: "Writing…",
};
