import {
  setTripPrimaryClient,
  updateTrip as dbUpdateTrip,
  type UpdateTripRecord,
} from "@pureluxe/db";
import { AppError, tripMessages, type UpdateTripInput } from "@pureluxe/shared";

import { requireActiveClient } from "@/lib/clients/require-active-client";

import { requireAssignedTrip } from "./require-assigned-trip";
import { buildTripDetail, type TripDetail } from "./trip-detail";
import { nextTripTitle } from "./trip-title";

/** Patch trip shell fields; returns Studio detail. */
export async function updateTrip(
  tripId: string,
  input: UpdateTripInput,
  actor: { memberId: string },
): Promise<TripDetail> {
  const existing = await requireAssignedTrip(tripId, actor.memberId);

  let clientName: string | null = null;
  if (input.primary_client_id) {
    const client = await requireActiveClient(input.primary_client_id);
    clientName = client.display_name;
  }

  const patch: UpdateTripRecord = {};
  if (input.primary_client_id !== undefined) {
    patch.primary_client_id = input.primary_client_id;
  }
  if (input.title !== undefined) {
    patch.title = input.title;
  } else if (clientName) {
    const autoTitle = nextTripTitle(existing.title, { clientName });
    if (autoTitle) patch.title = autoTitle;
  }
  if (input.status !== undefined) {
    patch.status = input.status;
  }

  const trip = await dbUpdateTrip(tripId, patch);

  if (!trip) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  if (input.primary_client_id) {
    await setTripPrimaryClient(trip.id, input.primary_client_id);
  }

  return buildTripDetail(trip);
}
