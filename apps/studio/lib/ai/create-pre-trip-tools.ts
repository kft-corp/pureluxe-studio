import type { DeskToolHandlers } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile, searchClients } from "@/lib/clients";

import { createDeskTools, type DeskActor } from "./create-desk-tools";
import { toClientBrief } from "./to-client-brief";
import { toClientSearchHit } from "./to-client-search-hit";

export type FoundClient = { id: string; display_name: string };

/**
 * Home chat tools (no trip open).
 * Client, history, and hotel tools — client_id required for get_client.
 * `onClients` reports real matches so the UI can offer Create trip · name chips.
 */
export function createPreTripTools(
  actor: DeskActor,
  onClients?: (clients: FoundClient[]) => void,
): DeskToolHandlers {
  return {
    ...createDeskTools(actor),

    async searchClients({ query, limit }) {
      const result = await searchClients({ q: query, limit: limit ?? 8 });
      const clients = result.clients.map(toClientSearchHit);
      if (clients.length > 0) {
        onClients?.(
          clients.map((client) => ({
            id: client.id,
            display_name: client.display_name,
          })),
        );
      }
      return { clients };
    },

    async getClient({ clientId }) {
      if (!clientId) {
        throw new AppError({
          userMessage:
            "Pass client_id from search_clients. No trip is open yet, so there is no assigned client.",
          code: "ai.client_id_required",
          status: 400,
        });
      }
      return toClientBrief(await getClientProfile(clientId));
    },
  };
}
