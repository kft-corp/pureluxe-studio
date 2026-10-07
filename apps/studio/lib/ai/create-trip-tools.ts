import type { TripToolHandlers } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile, searchClients } from "@/lib/clients";
import { getTripDetail } from "@/lib/trip-builder";

import { toClientBrief } from "./to-client-brief";
import { toClientSearchHit } from "./to-client-search-hit";
import { toTripFacts } from "./to-trip-facts";

type Options = {
  tripId: string;
  memberId: string;
};

/**
 * Trip chat tools (trip is open).
 * get_trip + search_clients + get_client (client_id optional → trip client).
 */
export function createTripTools(options: Options): TripToolHandlers {
  const actor = { memberId: options.memberId };

  return {
    async getTrip() {
      const detail = await getTripDetail(options.tripId, actor);
      return toTripFacts(detail);
    },

    async searchClients({ query, limit }) {
      const result = await searchClients({ q: query, limit: limit ?? 8 });
      return { clients: result.clients.map(toClientSearchHit) };
    },

    async getClient({ clientId }) {
      let id = clientId ?? null;

      if (!id) {
        const detail = await getTripDetail(options.tripId, actor);
        id = detail.client?.id ?? null;
      }

      if (!id) {
        throw new AppError({
          userMessage:
            "No client on this trip yet. Search for a client and assign via a Use chip, or pass client_id.",
          code: "ai.client_required",
          status: 400,
        });
      }

      return toClientBrief(await getClientProfile(id));
    },
  };
}
