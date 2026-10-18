import { tripIdSchema, tripMessages, updateTripSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { getTripDetail, updateTrip } from "@/lib/trip-builder";

/** Studio trip aggregate — assigned only. */
export const GET = apiRoute<{ id: string }>(
  "trip_builder.read",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const data = await getTripDetail(tripId, { memberId: session.memberId });
    return noStore(apiSuccess(data));
  },
);

/** Patch trip shell fields; returns full detail. */
export const PATCH = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const patch = updateTripSchema.parse(await request.json());
    const data = await updateTrip(tripId, patch, { memberId: session.memberId });
    return noStore(apiSuccess(data, { message: tripMessages.success.updated }));
  },
);
