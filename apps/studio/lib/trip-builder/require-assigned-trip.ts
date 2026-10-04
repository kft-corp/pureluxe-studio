import { findTripById, type Trip } from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

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
