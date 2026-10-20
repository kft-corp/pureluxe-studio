/**
 * Read-only tools for the home chat, and the chunks every chat streams.
 *
 *   clients/  — search_clients, get_client
 *   history/  — search_trips, search_bookings, get_booking
 *   hotels/   — get_hotel
 *   tool-sets — the home chat tool list
 *   execute   — routes by tool name to a domain module
 *   run-agent-loop — Claude tool loop for the home chat
 */

export { CLIENT_TOOLS, executeClientTool } from "./clients";
export type {
  ClientBrief,
  ClientLookupHandlers,
  ClientSearchHit,
  ClientToolHandlers,
} from "./clients";

export { HISTORY_TOOLS, executeHistoryTool } from "./history";
export type {
  BookingBrief,
  BookingHistoryRow,
  HistoryToolHandlers,
  SearchBookingsInput,
  SearchTripsInput,
  TripHistoryRow,
} from "./history";

export { HOTEL_TOOLS, executeHotelTool } from "./hotels";
export type { HotelBrief, HotelToolHandlers } from "./hotels";

export type { DeskToolHandlers } from "./handlers";

export { PRE_TRIP_READ_TOOLS } from "./tool-sets";

export { executeTool } from "./execute";
export {
  streamAgentLoop,
  type RunAgentLoopInput,
} from "./run-agent-loop";
export {
  AGENT_PHASE_LABEL,
  type AgentApproval,
  type AgentChoice,
  type AgentPhase,
  type AgentStreamChunk,
} from "./stream-chunk";
export {
  claudeRoundUsage,
  createTurnMeter,
  type AgentToolCallMetric,
  type AgentTurnMetrics,
  type ModelRoundUsage,
  type TurnMeter,
} from "./turn-meter";
