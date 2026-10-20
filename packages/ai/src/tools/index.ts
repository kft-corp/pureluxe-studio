/**
 * Read-only tools for Trip Builder AI.
 *
 *   clients/  — search_clients, get_client
 *   history/  — search_trips, search_bookings, get_booking
 *   hotels/   — get_hotel
 *   trip/     — get_trip
 *   tool-sets — composed lists for home vs trip chat
 *   execute   — routes by tool name to a domain module
 *   run-agent-loop — shared Claude tool loop
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

export { TRIP_TOOLS, executeTripTool } from "./trip";
export type { TripToolHandlers } from "./trip";

export { PRE_TRIP_READ_TOOLS, TRIP_BUILDER_READ_TOOLS } from "./tool-sets";

export { executeTool } from "./execute";
export {
  streamAgentLoop,
  type RunAgentLoopInput,
} from "./run-agent-loop";
export {
  AGENT_PHASE_LABEL,
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
