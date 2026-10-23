import type { ToolCallRef, TripAgentHandlers } from "@pureluxe/ai";
import { AppError } from "@pureluxe/shared";

import { getClientProfile } from "@/lib/clients";
import { readRateSnapshot } from "@/lib/rates/rate-search-store";
import { getTripDetail, getTripReadiness, type TripDetail } from "@/lib/trip-builder";
import {
  removeTripStay,
  setTripClient,
  setTripDates,
  setTripStays,
  setTripTravellers,
  shiftTrip,
  undoTripChange,
  type TripChangeContext,
} from "@/lib/trip-builder/actions";

import { createDeskTools, type DeskActor } from "./create-desk-tools";
import { toClientBrief } from "./to-client-brief";
import { toTripFacts } from "./to-trip-facts";

type Options = DeskActor & { tripId: string };

/**
 * Handlers for the trip agent. The trip id comes from the server, never from the
 * model; each change is keyed by its tool call so a retry never applies it twice.
 */
export function createTripAgentTools(options: Options): TripAgentHandlers {
  const actor = { memberId: options.memberId };
  /** The trip as the last change left it; the agent's next reload uses it instead of the database. */
  let changed: TripDetail | null = null;
  /** The trip as this reply last saw it. The run lock keeps other replies from changing it meanwhile. */
  let latest: TripDetail | null = null;

  const change = (tool: string, args: Record<string, unknown>, call: ToolCallRef): TripChangeContext => ({
    tripId: options.tripId,
    actor,
    tool,
    args,
    idempotencyKey: call.id,
    loaded: latest,
    onChanged: (after) => {
      changed = after;
      latest = after;
    },
  });

  return {
    ...createDeskTools(options),

    async getTrip() {
      const detail = changed ?? (await getTripDetail(options.tripId, actor));
      changed = null;
      latest = detail;
      return toTripFacts(detail, await getTripReadiness(options.tripId, actor, detail));
    },

    async getClient({ clientId }) {
      const id = clientId ?? (latest ?? (await getTripDetail(options.tripId, actor))).client?.id;
      if (!id) {
        throw new AppError({
          userMessage: "No client on this trip yet. Pass client_id from client_search.",
          code: "ai.client_required",
          status: 400,
        });
      }
      return toClientBrief(await getClientProfile(id));
    },

    getRateSnapshot: () => readRateSnapshot(options.tripId),

    setClient: (input, call) => setTripClient(change("trip_set_client", input, call), input),
    setTravellers: (input, call) => setTripTravellers(change("trip_set_travellers", input, call), input),
    setDates: (input, call) => setTripDates(change("trip_set_dates", input, call), input),
    setStays: (input, call) => setTripStays(change("trip_set_stays", input, call), input),
    removeStay: (input, call) => removeTripStay(change("trip_remove_stay", input, call), input),
    shiftDates: (input, call) => shiftTrip(change("trip_shift_dates", input, call), input),
    undo: (call) => undoTripChange(change("trip_undo", {}, call)),
  };
}
