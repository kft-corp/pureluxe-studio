import type Anthropic from "@anthropic-ai/sdk";

export const GET_HOTEL_TOOL: Anthropic.Tool = {
  name: "get_hotel",
  description: [
    "Load what PureLuxe has on file for a hotel by name, at any stage, including a hotel that is not on this trip.",
    "Returns check-in and check-out times, stay rules, cancellation, payment, transfers, benefits, required charges (gala dinner, half board),",
    "optional extras, offers, blackout dates, and minimum markup.",
    "Pass check_in and check_out to keep only the contracts, offers, and charges that cover those dates.",
    "Use for “is half board mandatory over New Year?”, “is there an offer?”, “what are the check-in times?”, or comparing two hotels (call once per hotel).",
    "An empty list means no hotel with that name. facts null means nothing is on file. Do not invent either.",
    "Read-only. Does not save the hotel on a stay.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Hotel name or part of it.",
      },
      check_in: {
        type: "string",
        description: "Optional YYYY-MM-DD.",
      },
      check_out: {
        type: "string",
        description: "Optional YYYY-MM-DD. Needs check_in.",
      },
    },
    required: ["name"],
  },
};

/** Hotel lookup tools. Available with or without an open trip. */
export const HOTEL_TOOLS: Anthropic.Tool[] = [GET_HOTEL_TOOL];
