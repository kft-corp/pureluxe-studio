import { tripIdSchema, tripMessages, updateTripLegSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { removeTripLeg, reviseTripLeg } from "@/lib/trip-builder";

type LegParams = { id: string; legId: string };

/** Change city and dates on one stay. */
export const PATCH = apiRoute<LegParams>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const legId = tripIdSchema.parse(params.legId);
    const input = updateTripLegSchema.parse(await request.json());
    const data = await reviseTripLeg(tripId, legId, input, { memberId: session.memberId });
    return noStore(apiSuccess(data, { message: tripMessages.success.legUpdated }));
  },
);

/** Remove one stay and cancel its pending booking. */
export const DELETE = apiRoute<LegParams>(
  "trip_builder.write",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const legId = tripIdSchema.parse(params.legId);
    const data = await removeTripLeg(tripId, legId, { memberId: session.memberId });
    return noStore(apiSuccess(data, { message: tripMessages.success.legRemoved }));
  },
);
