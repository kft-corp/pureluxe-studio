/**
 * Chat stream shapes, safe to import in the browser via "@pureluxe/ai/chat-stream"
 * (the package root also loads the agent runtime). Keep this file dependency-free.
 */

/** Lightweight phases for chat UI (Phase 1). */
export type AgentPhase = "thinking" | "looking_up" | "writing";

/** A button under the reply that runs an agent action directly. */
export type AgentChoice = {
  label: string;
  action: string;
  args: Record<string, unknown>;
};

/** An action the agent paused on until the advisor confirms. */
export type AgentApproval = {
  tool: string;
  args: Record<string, unknown>;
  /** What Confirm will do. */
  summary: string;
  /** Trip version the card was shown for; a later change refuses it. */
  tripVersion: number | null;
};

/** One piece of a streaming agent turn. */
export type AgentStreamChunk =
  | { kind: "status"; phase: AgentPhase }
  /** What the agent is doing right now, e.g. "Finding the client…". */
  | { kind: "progress"; label: string }
  | { kind: "delta"; text: string }
  /** The agent changed the trip. */
  | { kind: "changed"; summary: string; undo: boolean }
  | { kind: "choices"; choices: AgentChoice[] }
  /** The run paused; it continues when the advisor confirms or cancels. */
  | { kind: "approval"; approval: AgentApproval }
  /** Open this trip for the advisor (home chat). `created`: it was made in this turn. */
  | { kind: "opened"; tripId: string; created: boolean };

export const AGENT_PHASE_LABEL: Record<AgentPhase, string> = {
  thinking: "Thinking…",
  looking_up: "Gathering details…",
  writing: "Preparing the reply…",
};
