/**
 * Agent tools, grouped by area (trip_, client_, history_, hotel_, place_, rates_).
 * read tools look things up; the others change data (with Undo, or approval first).
 * The trip chat and the home chat share the lookups.
 */
import { clientGetTool, clientListTool, clientSearchTool } from "./clients";
import type { AgentToolSpec, ToolSchema } from "./define-tool";
import {
  historyGetBookingTool,
  historySearchBookingsTool,
  historySearchTripsTool,
} from "./history";
import { tripCreateTool, tripOpenTool } from "./home";
import { hotelFindTool, hotelGetTool } from "./hotels";
import { placeGetNotesTool } from "./places";
import {
  quoteAddOptionsTool,
  quoteEditLinesTool,
  quoteListLinesTool,
  quotePreviewTool,
  quoteRemoveOptionTool,
  quoteRewriteSectionTool,
  quoteSendTool,
  quoteSetClientPriceTool,
  quoteSetWordingTool,
  ratesUsePastedQuoteTool,
} from "./quote";
import { ratesGetSnapshotTool, ratesSearchTool } from "./rates";
import {
  tripGetTool,
  tripRemoveStayTool,
  tripSetClientTool,
  tripSetDatesTool,
  tripSetStaysTool,
  tripSetTravellersTool,
  tripShiftDatesTool,
  tripUndoTool,
} from "./trip";
import type { HomeAgentHandlers, TripAgentHandlers } from "../types";

const DESK_TOOLS = [
  clientSearchTool,
  clientGetTool,
  clientListTool,
  historySearchTripsTool,
  historySearchBookingsTool,
  historyGetBookingTool,
  hotelFindTool,
  hotelGetTool,
  placeGetNotesTool,
];

export const TRIP_AGENT_TOOLS: readonly AgentToolSpec<ToolSchema, TripAgentHandlers>[] = [
  tripGetTool,
  tripSetClientTool,
  tripSetTravellersTool,
  tripSetDatesTool,
  tripSetStaysTool,
  tripRemoveStayTool,
  tripShiftDatesTool,
  tripUndoTool,
  ...DESK_TOOLS,
  ratesSearchTool,
  ratesGetSnapshotTool,
  quoteAddOptionsTool,
  quoteSetClientPriceTool,
  quoteRemoveOptionTool,
  quoteSetWordingTool,
  quoteListLinesTool,
  quoteEditLinesTool,
  quoteRewriteSectionTool,
  quotePreviewTool,
  ratesUsePastedQuoteTool,
  quoteSendTool,
];

export const HOME_AGENT_TOOLS: readonly AgentToolSpec<ToolSchema, HomeAgentHandlers>[] = [
  tripCreateTool,
  tripOpenTool,
  ...DESK_TOOLS,
];

const BY_NAME = new Map<string, AgentToolSpec<ToolSchema, never>>(
  [...TRIP_AGENT_TOOLS, ...HOME_AGENT_TOOLS].map((spec) => [spec.name, spec]),
);

/** Any agent tool by name (progress labels, risk checks). Names are unique across both chats. */
export function findAgentTool(name: string): AgentToolSpec<ToolSchema, never> | null {
  return BY_NAME.get(name) ?? null;
}

export {
  bindAgentTools,
  defineAgentTool,
  defineDeskTool,
  defineHomeTool,
  type AgentToolSpec,
  type BindAgentToolsContext,
  type ToolSchema,
} from "./define-tool";
