import type { TripToolHandlers } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile, searchClients } from "@/lib/clients";
import { getTripDetail } from "@/lib/trip-builder";

import { createDeskTools, type DeskActor } from "./create-desk-tools";
import { toClientBrief } from "./to-client-brief";
import { toClientSearchHit } from "./to-client-search-hit";
import { toTripFacts } from "./to-trip-facts";

type Options = DeskActor & {
  tripId: string;
  /** Before-booking checks for get_trip. Worked out once per turn by the caller. */
  readiness?: string[];
};

/**
 * Trip chat tools (trip is open).
 * get_trip + client, history, and hotel tools (client_id optional → trip client).
 */
export function createTripTools(options: Options): TripToolHandlers {
  const actor = { memberId: options.memberId };

  return {
    ...createDeskTools(options),

    async getTrip() {
      const detail = await getTripDetail(options.tripId, actor);
      return toTripFacts(detail, options.readiness);
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
            "No client on this trip yet. Pass client_id from search_clients.",
          code: "ai.client_required",
          status: 400,
        });
      }

      return toClientBrief(await getClientProfile(id));
    },
  };
}
