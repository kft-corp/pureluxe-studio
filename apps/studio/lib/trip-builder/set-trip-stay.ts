import {
  findActivePropertyById,
  findTripById,
  upsertFirstTripLeg,
  upsertStayShellLineItem,
} from "@pureluxe/db";
import { AppError, tripMessages, type SetTripStayInput } from "@pureluxe/shared";

import { requireAssignedTrip } from "./require-assigned-trip";
import { buildTripDetail, type TripDetail } from "./trip-detail";

/**
 * Set Phase 1 fixed stay: first leg (city + dates) + named-hotel shell.
 * Blocked while pricing is locked.
 */
export async function setTripStay(
  tripId: string,
  input: SetTripStayInput,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireAssignedTrip(tripId, actor.memberId);

  if (trip.pricing_locked_at) {
    throw new AppError({
      userMessage: tripMessages.error.pricingLocked,
      code: "trips.pricing_locked",
      status: 409,
    });
  }

  let propertyId = input.property_id;
  let propertyName = input.property_name;
  let destinationProfileId = input.destination_profile_id;
  const city = input.city.trim();

  if (propertyId) {
    const property = await findActivePropertyById(propertyId);
    if (!property) {
      throw new AppError({
        userMessage: tripMessages.error.propertyNotFound,
        code: "trips.property_not_found",
        status: 404,
      });
    }

    propertyName = propertyName ?? property.name;
    destinationProfileId =
      destinationProfileId ?? property.destination_profile_id;
  }

  const hotelName = propertyName?.trim();
  if (!hotelName) {
    throw new AppError({
      userMessage: tripMessages.error.hotelRequired,
      code: "trips.hotel_required",
      status: 400,
    });
  }

  const leg = await upsertFirstTripLeg({
    trip_id: trip.id,
    destination: city,
    check_in: input.check_in,
    check_out: input.check_out,
    destination_profile_id: destinationProfileId,
  });

  await upsertStayShellLineItem({
    trip_id: trip.id,
    leg_id: leg.id,
    property_id: propertyId,
    property_name: hotelName,
    created_by_id: actor.memberId,
  });

  const fresh = (await findTripById(trip.id)) ?? trip;
  return buildTripDetail(fresh);
}
