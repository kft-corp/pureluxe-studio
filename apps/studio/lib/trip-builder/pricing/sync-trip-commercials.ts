import { findTripById } from "@pureluxe/db";

import { closeTripRateSearches } from "@/lib/rates/rate-search-store";

import { buildTripDetail } from "../trip/trip-detail";
import { syncTripHotelBooking } from "./sync-trip-booking";
import {
  syncClientPriceFromChoices,
  syncTripCommercials,
} from "./sync-trip-totals";

export { syncClientPriceFromChoices, syncTripCommercials } from "./sync-trip-totals";

/** Recompute trip totals, then refresh hotel bookings when a client is on the trip. */
export async function refreshTripAfterRateChange(
  tripId: string,
  actor: { memberId: string },
): Promise<void> {
  await syncTripCommercials(tripId);
  await closeTripRateSearches(tripId);
  const trip = await findTripById(tripId);
  if (!trip?.primary_client_id) return;
  const detail = await buildTripDetail(trip);
  await syncTripHotelBooking(detail, actor);
}
