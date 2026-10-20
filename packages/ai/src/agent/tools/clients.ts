import { z } from "zod";

import type { ClientSearchHit } from "../../tools";

import { defineAgentTool } from "./define-tool";

function searchHits(result: unknown): ClientSearchHit[] {
  const clients = (result as { clients?: unknown } | null)?.clients;
  return Array.isArray(clients) ? (clients as ClientSearchHit[]) : [];
}

export const clientSearchTool = defineAgentTool({
  name: "client_search",
  description: [
    "Find Studio clients by name, email or phone.",
    "Use when the advisor names a person, or pastes an email or phone, and you don't have their client id.",
    "Do not use for the lead client already on the trip (use client_get with no id).",
    "Returns candidates: name, email, phone, tier, review status and whether they have a family. An empty list means no match; never invent one.",
    "When the trip has no lead yet and several match, a button for each appears under your reply.",
  ].join(" "),
  schema: z
    .object({
      query: z.string().trim().min(1).max(200).describe("Name, email or phone fragment."),
      limit: z.number().int().min(1).max(10).optional().describe("Max results, 1–10. Default 8."),
    })
    .strict(),
  risk: "read",
  progress: () => "Searching clients…",
  run: (input, handlers) => handlers.searchClients({ query: input.query, limit: input.limit }),
  choices: (result, trip) => {
    const hits = searchHits(result);
    if (trip?.client || hits.length < 2) return [];
    return hits.map((hit) => ({
      label: hit.display_name,
      action: "trip_set_client",
      args: { client_id: hit.id },
    }));
  },
});

export const clientGetTool = defineAgentTool({
  name: "client_get",
  description: [
    "Load one client's profile: contact, tier, language, residence, company, relationship owner, preferences (prefer / avoid / require), family, dietary and mobility, document type / status / expiry, guest notes and counts.",
    "Use for any profile question or count. Omit client_id for the trip's lead client; pass the id from client_search for anyone else.",
    "Do not use to find a person by name (use client_search first).",
    "Returns the profile. Counts are exact and zero is a real answer. Passport numbers, medication and emergency contacts are never included.",
  ].join(" "),
  schema: z
    .object({
      client_id: z
        .string()
        .uuid()
        .optional()
        .describe("Client id from client_search. Omit for the trip's lead client."),
    })
    .strict(),
  risk: "read",
  progress: () => "Loading the client…",
  run: (input, handlers) => handlers.getClient({ clientId: input.client_id }),
});
