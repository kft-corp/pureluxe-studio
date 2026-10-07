import type Anthropic from "@anthropic-ai/sdk";

export const GET_TRIP_TOOL: Anthropic.Tool = {
  name: "get_trip",
  description: [
    "Load the current trip facts (client, stay, rates, quote, stage gaps).",
    "Use when the advisor asks what is on the trip, what is missing,",
    "or when you need to confirm the latest trip state before answering.",
    "Read-only — does not change the trip.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {},
    required: [],
  },
};

/** Trip-domain Claude tools (facts only for now). */
export const TRIP_TOOLS: Anthropic.Tool[] = [GET_TRIP_TOOL];
