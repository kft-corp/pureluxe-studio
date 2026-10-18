import { addTripLegSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { addTripLeg } from "@/lib/trip-builder";

/** Add another stay (city + dates). Hotel is saved on that stay afterwards. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const input = addTripLegSchema.parse(await request.json());
    const data = await addTripLeg(tripId, input, { memberId: session.memberId });
    return noStore(apiSuccess(data, { message: tripMessages.success.legAdded }));
  },
);
