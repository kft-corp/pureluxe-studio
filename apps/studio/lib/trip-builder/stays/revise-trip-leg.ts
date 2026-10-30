import {
  findTripById,
  findTripLegById,
  listTripLegs,
  updateTripLeg,
} from "@pureluxe/db";
import { AppError, tripMessages, type UpdateTripLegInput } from "@pureluxe/shared";

import { requireEditableTrip } from "../access/require-assigned-trip";
import {
  assertNoUnconfirmedOverlap,
  cancelStayBooking,
  clearStaleQuotePricesForLeg,
} from "./stay-side-effects";
import { refreshOptionsQuotePdfAfterChange } from "../options-quote/options-quote";
import { syncTripCommercials } from "../pricing/sync-trip-commercials";
import { syncTripHotelBooking } from "../pricing/sync-trip-booking";
import { closeTripRateSearches } from "@/lib/rates/rate-search-store";
import { buildTripDetail, type TripDetail } from "../trip/trip-detail";
import { assertStayInsideTrip } from "../trip/trip-window";

/** Change city or dates on a stay that already exists. Hotel and party stay as they are. */
export async function reviseTripLeg(
  tripId: string,
  legId: string,
  input: UpdateTripLegInput,
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

  assertStayInsideTrip(trip, input.check_in, input.check_out);
  const legs = await listTripLegs(trip.id);
  assertNoUnconfirmedOverlap(
    legs,
    input.check_in,
    input.check_out,
    existing.id,
    input.confirm_overlap,
  );

  const datesChanged =
    existing.check_in !== input.check_in || existing.check_out !== input.check_out;
  const cityChanged =
    existing.destination.trim().toLowerCase() !== input.city.trim().toLowerCase();
  if (datesChanged || cityChanged) {
    await clearStaleQuotePricesForLeg(trip.id, existing.id);
    await cancelStayBooking(trip.id, existing.id, actor, {
      pendingOnly: true,
      reason: "Stay changed in Trip Builder",
    });
  }

  await updateTripLeg(existing.id, {
    destination: input.city.trim(),
    check_in: input.check_in,
    check_out: input.check_out,
    destination_profile_id: existing.destination_profile_id,
  });

  await refreshOptionsQuotePdfAfterChange(trip.id, actor);
  await syncTripCommercials(trip.id);
  const fresh = (await findTripById(trip.id)) ?? trip;
  await closeTripRateSearches(trip.id);
  const detail = await buildTripDetail(fresh);
  const stay = detail.stays.find((item) => item.leg_id === existing.id);
  if (stay?.property_name) {
    await syncTripHotelBooking(detail, actor);
  }
  return detail;
}
