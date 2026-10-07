import type Anthropic from "@anthropic-ai/sdk";

export const SEARCH_CLIENTS_TOOL: Anthropic.Tool = {
  name: "search_clients",
  description: [
    "Search Studio clients by name, email, or phone.",
    "Use when the advisor asks to find or match a client.",
    "Returns candidates with tier/phone — you cannot assign a client;",
    "tell the advisor to tap a Use / Create trip chip to assign.",
    "If the result list is empty: tell them no matching client exists,",
    "and they should create a new client in the Clients module (Studio → Clients → New client).",
    "You cannot create clients from this chat.",
    "For preference/document/family counts on a specific person, call get_client next.",
    "Read-only — does not change the trip or client.",
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
    "Load a lean Studio client brief: contact, tier, preferences, documents,",
    "family, health summary, and authoritative counts (preferences, documents,",
    "family members, relationships, bookings, open trips).",
    "Use for advisor questions like how many preferences/documents/family members,",
    "dietary needs, passport status, or a client overview.",
    "On an open trip, omit client_id to use the assigned client.",
    "Before a trip exists, client_id is required (from search_clients).",
    "Read-only — does not change the trip or client.",
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
