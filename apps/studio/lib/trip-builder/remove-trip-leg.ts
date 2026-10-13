import { findTripById, findTripLegById } from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { requireEditableTrip } from "./require-assigned-trip";
import { markQuoteStale, removeStayRecord } from "./stay-side-effects";
import { clearTripDossier } from "./trip-dossier";
import { buildTripDetail, type TripDetail } from "./trip-detail";

/** Remove one stay, cancel its pending booking, and clear its rate. */
export async function removeTripLeg(
  tripId: string,
  legId: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireEditableTrip(tripId, actor.memberId);

  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  const existing = await findTripLegById(legId);
  if (!existing || existing.trip_id !== trip.id) {
    throw new AppError({
      userMessage: tripMessages.error.notFound,
      code: "trips.leg_not_found",
      status: 404,
    });
  }

  await removeStayRecord(trip.id, existing.id, actor);
  await markQuoteStale(trip.id);
  clearTripDossier(trip.id);
  const fresh = (await findTripById(trip.id)) ?? trip;
  return buildTripDetail(fresh);
}
