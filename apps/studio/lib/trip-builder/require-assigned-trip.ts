import { findTripById, type Trip } from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { isQuoteAccepted, isTripClosed } from "./trip-lock";

/** Load a trip assigned to the actor, or throw 404 / 403. */
export async function requireAssignedTrip(
  tripId: string,
  actorMemberId: string,
): Promise<Trip> {
  const trip = await findTripById(tripId);

  if (!trip || trip.is_demo || trip.archived_at) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.not_found",
      status: 404,
    });
  }

  if (trip.relationship_owner_id !== actorMemberId) {
    throw new AppError({
      userMessage: tripMessages.error.forbidden,
      code: "trips.forbidden",
      status: 403,
    });
  }

  return trip;
}

/** Assigned trip that can still be changed. Cancelled trips are read-only. */
export async function requireEditableTrip(
  tripId: string,
  actorMemberId: string,
): Promise<Trip> {
  const trip = await requireAssignedTrip(tripId, actorMemberId);
  if (isTripClosed(trip.status)) {
    throw new AppError({
      userMessage: tripMessages.error.tripClosedEdit,
      code: "trips.cancelled",
      status: 409,
    });
  }
  return trip;
}

/** Editable trip whose client quote can still change (not accepted yet). */
export async function requireOpenQuoteTrip(
  tripId: string,
  actorMemberId: string,
): Promise<Trip> {
  const trip = await requireEditableTrip(tripId, actorMemberId);
  if (isQuoteAccepted(trip.status)) {
    throw new AppError({
      userMessage: tripMessages.error.quoteAccepted,
      code: "trips.quote_accepted",
      status: 409,
    });
  }
  return trip;
}
