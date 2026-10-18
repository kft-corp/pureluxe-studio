import { setTripStaySchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { setTripStay } from "@/lib/trip-builder";

/** Set Phase 1 fixed stay — hotel + city + dates. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const input = setTripStaySchema.parse(await request.json());
    const data = await setTripStay(tripId, input, { memberId: session.memberId });
    return noStore(apiSuccess(data, { message: tripMessages.success.staySaved }));
  },
);
