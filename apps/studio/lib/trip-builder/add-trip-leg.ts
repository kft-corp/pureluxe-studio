import { findTripById, insertTripLeg, listTripLegs } from "@pureluxe/db";
import { AppError, tripMessages, type AddTripLegInput } from "@pureluxe/shared";

import { requireEditableTrip } from "./require-assigned-trip";
import { assertNoUnconfirmedOverlap, markQuoteStale } from "./stay-side-effects";
import { clearTripDossier } from "./trip-dossier";
import { buildTripDetail, type TripDetail } from "./trip-detail";
import { assertStayInsideTrip } from "./trip-window";

/**
 * Append a stay with city and dates. The hotel is saved later on this leg.
 * Allowed after the stay list is finished, as long as the dates sit inside the trip.
 */
export async function addTripLeg(
  tripId: string,
  input: AddTripLegInput,
  actor: { memberId: string },
): Promise<{ detail: TripDetail; leg_id: string }> {
  const trip = await requireEditableTrip(tripId, actor.memberId);

  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  assertStayInsideTrip(trip, input.check_in, input.check_out);
  const legs = await listTripLegs(trip.id);
  assertNoUnconfirmedOverlap(
    legs,
    input.check_in,
    input.check_out,
    null,
    input.confirm_overlap,
  );

  const leg = await insertTripLeg({
    trip_id: trip.id,
    destination: input.city.trim(),
    check_in: input.check_in,
    check_out: input.check_out,
  });

  await markQuoteStale(trip.id);
  clearTripDossier(trip.id);
  const fresh = (await findTripById(trip.id)) ?? trip;
  return {
    detail: await buildTripDetail(fresh),
    leg_id: leg.id,
  };
}
