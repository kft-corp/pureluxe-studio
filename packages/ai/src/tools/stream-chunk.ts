/**
 * Chat stream shapes, safe to import in the browser via "@pureluxe/ai/chat-stream"
 * (the package root also loads the agent runtime). Keep this file dependency-free.
 */

import type { LegSplitCard } from "./leg-split";
import type { RateCompareCard } from "./rate-compare";

export type {
  RateCompareCard,
  RateCompareHotel,
  RateCompareHotelNotes,
  RateCompareHotelStatus,
  RateCompareRoom,
} from "./rate-compare";

export type { LegSplitCard, LegSplitStay } from "./leg-split";

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
  /** Multi-hotel rate comparison card (Stage 3c). */
  | { kind: "rate_compare"; compare: RateCompareCard }
  /** Multi-city date split proposal (Stage 4). */
  | { kind: "leg_split"; split: LegSplitCard }
  /** The run paused; it continues when the advisor confirms or cancels. */
  | { kind: "approval"; approval: AgentApproval }
  /** Open this trip for the advisor (home chat). `created`: it was made in this turn. */
  | { kind: "opened"; tripId: string; created: boolean }
  /** Open the options quote PDF in a new tab (short-lived signed URL). */
  | { kind: "quote_preview"; url: string };

export const AGENT_PHASE_LABEL: Record<AgentPhase, string> = {
  thinking: "Thinking…",
  looking_up: "Gathering details…",
  writing: "Preparing the reply…",
};
