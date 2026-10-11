import type Anthropic from "@anthropic-ai/sdk";

export const SEARCH_CLIENTS_TOOL: Anthropic.Tool = {
  name: "search_clients",
  description: [
    "Search Studio clients by name, email, or phone.",
    "Use when the advisor names a person, or pastes an email or phone, and you do not already have their id.",
    "Returns candidates only: name, email, phone, tier, review status, and whether they have a family.",
    "Enough for “do we have them?” plus contact and tier.",
    "For preferences, documents, family, health, notes, or counts, call get_client with the id.",
    "An empty list means no matching client. Do not invent one.",
    "Read-only. Does not create a client or a trip.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Client name, email, or phone fragment to search.",
      },
      limit: {
        type: "number",
        description: "Max results (1–10). Defaults to 8.",
      },
    },
    required: ["query"],
  },
};

export const GET_CLIENT_TOOL: Anthropic.Tool = {
  name: "get_client",
  description: [
    "Load one Studio client: contact, tier, language, residence, company,",
    "relationship owner, preferences (prefer / avoid / require), family members,",
    "dietary and mobility, document type / status / expiry, guest notes, and counts.",
    "Call after you have an id. On an open trip, omit client_id to use the assigned client.",
    "Before a trip exists, client_id from search_clients is required.",
    "Use counts for how many preferences, documents, family members, bookings, or open trips.",
    "Report zeros. Read-only. Does not assign the client or create a trip.",
  ].join(" "),
  input_schema: {
    type: "object",
    properties: {
      client_id: {
        type: "string",
        description:
          "Studio client UUID. Required before a trip exists; optional when a client is already assigned on the trip.",
      },
    },
    required: [],
  },
};

/** All client-domain Claude tools. */
export const CLIENT_TOOLS: Anthropic.Tool[] = [
  SEARCH_CLIENTS_TOOL,
  GET_CLIENT_TOOL,
];
