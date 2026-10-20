import type Anthropic from "@anthropic-ai/sdk";

import { CLIENT_TOOLS } from "./clients";
import { HISTORY_TOOLS } from "./history";
import { HOTEL_TOOLS } from "./hotels";

/** Home chat (no trip): client, history, and hotel tools. */
export const PRE_TRIP_READ_TOOLS: Anthropic.Tool[] = [
  ...CLIENT_TOOLS,
  ...HISTORY_TOOLS,
  ...HOTEL_TOOLS,
];
