import { requireAssignedTrip } from "../access/require-assigned-trip";
import { buildTripDetail, type TripDetail } from "./trip-detail";

/** Load assigned trip aggregate for Studio. */
export async function getTripDetail(
  tripId: string,
  actor: { memberId: string },
): Promise<TripDetail> {
  const trip = await requireAssignedTrip(tripId, actor.memberId);
  return buildTripDetail(trip);
}
