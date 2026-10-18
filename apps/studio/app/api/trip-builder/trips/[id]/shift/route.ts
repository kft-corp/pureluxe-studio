import { shiftTripDatesSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { shiftTripDates } from "@/lib/trip-builder";

/** Move the trip and every stay by the same number of days. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const { days } = shiftTripDatesSchema.parse(await request.json());
    const data = await shiftTripDates(tripId, days, { memberId: session.memberId });
    return noStore(apiSuccess(data, { message: tripMessages.success.datesShifted }));
  },
);
