/**
 * Shapes the agent tools return and the chunks every chat streams.
 *
 *   clients/, history/, hotels/ — what each lookup returns, and the Studio callbacks behind it
 *   stream-chunk — chat stream chunks (browser-safe)
 *   turn-meter   — per-turn timings and token use for agent_turns
 */

export type { ClientBrief, ClientSearchHit, ClientToolHandlers } from "./clients";
export type {
  BookingBrief,
  BookingHistoryRow,
  HistoryToolHandlers,
  SearchBookingsInput,
  SearchTripsInput,
  TripHistoryRow,
} from "./history";
export type { HotelBrief, HotelToolHandlers } from "./hotels";
export type { DeskToolHandlers } from "./handlers";
export {
  AGENT_PHASE_LABEL,
  type AgentApproval,
  type AgentChoice,
  type AgentPhase,
  type AgentStreamChunk,
} from "./stream-chunk";
export {
  createTurnMeter,
  type AgentToolCallMetric,
  type AgentTurnMetrics,
  type ModelRoundUsage,
  type TurnMeter,
} from "./turn-meter";
