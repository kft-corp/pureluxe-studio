import type Anthropic from "@anthropic-ai/sdk";

import { CLIENT_TOOLS } from "./clients";
import { TRIP_TOOLS } from "./trip";

/** Home chat (no trip): client tools only. */
export const PRE_TRIP_READ_TOOLS: Anthropic.Tool[] = [...CLIENT_TOOLS];

/** Trip chat: trip facts + client tools. */
export const TRIP_BUILDER_READ_TOOLS: Anthropic.Tool[] = [
  ...TRIP_TOOLS,
  ...CLIENT_TOOLS,
];
