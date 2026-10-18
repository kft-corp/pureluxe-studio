import {
  clearSelectedAccommodationForLeg,
  findOpenHotelBookingForTrip,
  findTripById,
  listTripLegs,
  updateTrip as dbUpdateTrip,
  updateTripLeg,
  type TripLeg,
} from "@pureluxe/db";
import { AppError, tripMessages } from "@pureluxe/shared";

import { requireEditableTrip } from "../access/require-assigned-trip";
import { cancelStayBooking, markQuoteStale } from "../stays/stay-side-effects";
import { syncTripCommercials } from "../pricing/sync-trip-commercials";
import { syncTripHotelBooking } from "../pricing/sync-trip-booking";
import { clearTripDossier } from "../chat/trip-dossier";
import { buildTripDetail, type TripDetail } from "./trip-detail";

function shiftDay(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + days)).toISOString().slice(0, 10);
}

function writeLegDates(leg: TripLeg, checkIn: string, checkOut: string) {
  return updateTripLeg(leg.id, {
    destination: leg.destination,
    check_in: checkIn,
    check_out: checkOut,
    destination_profile_id: leg.destination_profile_id,
  });
}

/**
 * Move the trip dates and every stay by the same number of days, for example
 * when a flight moves. Cities, hotels, and party stay; each stay's chosen rate
 * clears because prices depend on dates. Refused while a stay has a confirmed
 * booking, because that booking would keep the old dates.
 */
export async function shiftTripDates(
  tripId: string,
  days: number,
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
  const { starts_on: startsOn, ends_on: endsOn } = trip;
  if (!startsOn || !endsOn) {
    throw new AppError({
      userMessage: tripMessages.error.tripDatesRequired,
      code: "trips.dates_required",
      status: 409,
    });
  }

  const legs = await listTripLegs(trip.id);
  const bookings = await Promise.all(
    legs.map((leg) => findOpenHotelBookingForTrip(trip.id, leg.id)),
  );
  if (bookings.some((row) => row?.status === "confirmed" || row?.status === "completed")) {
    throw new AppError({
      userMessage: tripMessages.error.shiftConfirmedBooking,
      code: "trips.shift_confirmed_booking",
      status: 409,
    });
  }

  // One leg at a time so a failure can put the moved ones back.
  const moved: TripLeg[] = [];
  try {
    for (const leg of legs) {
      if (!leg.check_in || !leg.check_out) continue;
      await writeLegDates(leg, shiftDay(leg.check_in, days), shiftDay(leg.check_out, days));
      moved.push(leg);
    }
    await dbUpdateTrip(trip.id, {
      starts_on: shiftDay(startsOn, days),
      ends_on: shiftDay(endsOn, days),
    });
  } catch (cause) {
    await Promise.allSettled(
      moved.map((leg) => writeLegDates(leg, leg.check_in!, leg.check_out!)),
    );
    throw cause;
  }

  for (const leg of legs) {
    await clearSelectedAccommodationForLeg(trip.id, leg.id);
    await cancelStayBooking(trip.id, leg.id, actor, {
      pendingOnly: true,
      reason: "Trip dates shifted in Trip Builder",
    });
  }
  await markQuoteStale(trip.id);
  await syncTripCommercials(trip.id);
  const fresh = (await findTripById(trip.id)) ?? trip;
  clearTripDossier(trip.id);
  const detail = await buildTripDetail(fresh);
  if (detail.stays.some((stay) => stay.property_name)) {
    await syncTripHotelBooking(detail, actor);
  }
  return detail;
}
