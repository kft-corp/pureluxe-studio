/**
 * Trip agent tools, grouped by area (trip_, client_, history_, hotel_, place_, rates_).
 * Stage 1: read-only. Write tools join this list with risk "undo" or "approval".
 */
import { clientGetTool, clientSearchTool } from "./clients";
import type { AgentToolSpec } from "./define-tool";
import {
  historyGetBookingTool,
  historySearchBookingsTool,
  historySearchTripsTool,
} from "./history";
import { hotelGetTool } from "./hotels";
import { placeGetNotesTool } from "./places";
import { ratesGetSnapshotTool } from "./rates";
import { tripGetTool } from "./trip";

export const TRIP_AGENT_TOOLS: readonly AgentToolSpec[] = [
  tripGetTool,
  clientSearchTool,
  clientGetTool,
  historySearchTripsTool,
  historySearchBookingsTool,
  historyGetBookingTool,
  hotelGetTool,
  placeGetNotesTool,
  ratesGetSnapshotTool,
];

const BY_NAME = new Map(TRIP_AGENT_TOOLS.map((spec) => [spec.name, spec]));

export function findAgentTool(name: string): AgentToolSpec | null {
  return BY_NAME.get(name) ?? null;
}

export {
  bindAgentTools,
  defineAgentTool,
  type AgentToolSpec,
  type BindAgentToolsContext,
} from "./define-tool";
