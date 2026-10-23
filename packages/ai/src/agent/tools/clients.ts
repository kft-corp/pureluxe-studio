import { z } from "zod";

import type { AgentChoice, ClientSearchHit } from "../../tools";
import type { TripFacts } from "../../types";

import { defineDeskTool } from "./define-tool";

/** Buttons under a reply never exceed this. */
const MAX_CHOICES = 6;

function searchHits(result: unknown): ClientSearchHit[] {
  const clients = (result as { clients?: unknown } | null)?.clients;
  return Array.isArray(clients) ? (clients as ClientSearchHit[]) : [];
}

/** Every match belongs to the same household ("the Mehta family"). */
function oneHousehold(hits: ClientSearchHit[]): boolean {
  return new Set(hits.map((hit) => hit.household_id ?? hit.id)).size === 1;
}

/**
 * One button per person when several different people match: "Create trip · name" in
 * the home chat, or the lead in a trip chat that has none yet.
 */
function clientChoices(result: unknown, trip: TripFacts | null): AgentChoice[] {
  const hits = searchHits(result).slice(0, MAX_CHOICES);
  if (hits.length < 2 || oneHousehold(hits) || trip?.client) return [];
  if (trip) {
    return hits.map((hit) => ({
      label: hit.display_name,
      action: "trip_set_client",
      args: { client_id: hit.id },
    }));
  }
  return hits.map((hit) => ({
    label: `Create trip · ${hit.display_name}`,
    action: "client_get",
    args: { client_id: hit.id },
  }));
}

export const clientSearchTool = defineDeskTool({
  name: "client_search",
  description: [
    "Find Studio clients by name, email or phone.",
    "Use when the advisor names a person or a family, or pastes an email or phone, and you don't have their client id.",
    "Do not use for the lead client already on the trip (use client_get with no id).",
    "Returns candidates: name, email, phone, tier, review status and household_id (the same id means the same household; null means none). An empty list means no match; never invent one.",
    "When several different people match, a button for each appears under your reply.",
  ].join(" "),
  schema: z
    .object({
      query: z.string().trim().min(1).max(200).describe("Name, email or phone fragment."),
      limit: z.number().int().min(1).max(10).optional().describe("Max results, 1–10. Default 8."),
    })
    .strict(),
  risk: "read",
  progress: () => "Finding the client…",
  run: (input, handlers) => handlers.searchClients({ query: input.query, limit: input.limit }),
  choices: clientChoices,
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const clientListTool = defineDeskTool({
  name: "client_list",
  description: [
    "Count and list clients across the whole client base, with optional filters: tier, review status, date added, the advisor's own or unassigned, missing contact details, in a household.",
    "Use for how many clients there are, the newest or recently added clients, VIP or VVIP clients, clients pending review, clients with no owner, the advisor's own clients, or clients with no email and no phone.",
    "Do not use to find one person by name (use client_search) or for one client's profile (use client_get).",
    "Returns total, the number of clients matching the filters (the answer to \"how many\"), and up to limit of them: name, tier, review status, date added and household.",
  ].join(" "),
  schema: z
    .object({
      tier: z.enum(["standard", "vip", "vvip"]).optional().describe("Only this tier. Omit for every tier."),
      review_status: z.enum(["pending", "approved"]).optional().describe("pending = new clients waiting for review."),
      added_from: isoDate.optional().describe("Added on or after this day, YYYY-MM-DD. Work it out from today."),
      added_to: isoDate.optional().describe("Added on or before this day, YYYY-MM-DD."),
      owner: z.enum(["mine", "unassigned"]).optional().describe("mine = the advisor's own clients; unassigned = no owner."),
      missing_contact: z.boolean().optional().describe("true = clients with no email and no phone."),
      in_household: z.boolean().optional().describe("true = only clients in a household."),
      sort: z.enum(["newest", "name"]).optional().describe("newest = most recently added first (default); name = A to Z."),
      limit: z.number().int().min(1).max(20).optional().describe("Clients to list, 1–20. Default 10. total is counted either way."),
    })
    .strict(),
  risk: "read",
  progress: () => "Reviewing the client list…",
  run: async (input, handlers) => {
    if (input.added_from && input.added_to && input.added_from > input.added_to) {
      return { error: "added_from must be on or before added_to." };
    }
    return handlers.listClients({
      tier: input.tier,
      reviewStatus: input.review_status,
      addedFrom: input.added_from,
      addedTo: input.added_to,
      owner: input.owner,
      missingContact: input.missing_contact,
      inHousehold: input.in_household,
      sort: input.sort,
      limit: input.limit,
    });
  },
});

export const clientGetTool = defineDeskTool({
  name: "client_get",
  description: [
    "Load one client's profile: contact, tier, language, residence, company, relationship owner, preferences (prefer / avoid / require), family with its primary member, dietary and mobility, document type / status / expiry, guest notes and counts.",
    "Use for any profile question or count. In a trip chat, omit client_id for the trip's lead client; otherwise pass the id from client_search.",
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
  progress: () => "Reviewing the client profile…",
  run: (input, handlers) => handlers.getClient({ clientId: input.client_id }),
});
