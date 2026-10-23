import type { HomeAgentHandlers } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile } from "@/lib/clients";
import { requireAssignedTrip } from "@/lib/trip-builder/access/require-assigned-trip";
import { createTripFromChat } from "@/lib/trip-builder/actions";

import { createDeskTools, type DeskActor } from "./create-desk-tools";
import { toClientBrief } from "./to-client-brief";

type Options = DeskActor & {
  /** The advisor's send key: one message creates at most one trip, even when retried. */
  clientRequestId: string;
};

/** Handlers for the home chat (no trip open): lookups, creating a trip, opening one. */
export function createHomeAgentTools(options: Options): HomeAgentHandlers {
  const actor = { memberId: options.memberId };

  return {
    ...createDeskTools(options),

    async getClient({ clientId }) {
      if (!clientId) {
        throw new AppError({
          userMessage: "No trip is open, so pass client_id from client_search.",
          code: "ai.client_id_required",
          status: 400,
        });
      }
      return toClientBrief(await getClientProfile(clientId));
    },

    createTrip: (input) =>
      createTripFromChat({ actor, idempotencyKey: `trip_create:${options.clientRequestId}` }, input),

    async openTrip({ tripId }) {
      const trip = await requireAssignedTrip(tripId, actor.memberId);
      return { ok: true, trip_id: trip.id, title: trip.title };
    },
  };
}
