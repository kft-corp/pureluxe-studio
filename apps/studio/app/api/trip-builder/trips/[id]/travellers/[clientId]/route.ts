import { tripIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { removeTripTraveller } from "@/lib/trip-builder";

/** Remove a companion from the trip. */
export const DELETE = apiRoute<{ id: string; clientId: string }>(
  "trip_builder.write",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const companionId = tripIdSchema.parse(params.clientId);
    const data = await removeTripTraveller(tripId, companionId, { memberId: session.memberId });
    return noStore(apiSuccess(data));
  },
);
