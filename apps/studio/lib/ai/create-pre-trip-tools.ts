import type { ClientToolHandlers } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile, searchClients } from "@/lib/clients";

import { toClientBrief } from "./to-client-brief";
import { toClientSearchHit } from "./to-client-search-hit";

/**
 * Home chat tools (no trip open).
 * Only search_clients + get_client — client_id required for get_client.
 */
export function createPreTripTools(): ClientToolHandlers {
  return {
    async searchClients({ query, limit }) {
      const result = await searchClients({ q: query, limit: limit ?? 8 });
      return { clients: result.clients.map(toClientSearchHit) };
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
