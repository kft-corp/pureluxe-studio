import type Anthropic from "@anthropic-ai/sdk";

import { CLIENT_TOOLS } from "./clients";
import { HISTORY_TOOLS } from "./history";
import { HOTEL_TOOLS } from "./hotels";
import { TRIP_TOOLS } from "./trip";

/** Home chat (no trip): client, history, and hotel tools. */
export const PRE_TRIP_READ_TOOLS: Anthropic.Tool[] = [
  ...CLIENT_TOOLS,
  ...HISTORY_TOOLS,
  ...HOTEL_TOOLS,
];

/** Trip chat: trip facts + everything the home chat has. */
export const TRIP_BUILDER_READ_TOOLS: Anthropic.Tool[] = [
  ...TRIP_TOOLS,
  ...PRE_TRIP_READ_TOOLS,
];
