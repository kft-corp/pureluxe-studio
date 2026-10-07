/**
 * Read-only tools for Trip Builder AI.
 *
 *   clients/  — search_clients, get_client
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
