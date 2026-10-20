import { tripIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { getTripDetail } from "@/lib/trip-builder";

/** Studio trip aggregate — assigned only. */
export const GET = apiRoute<{ id: string }>(
  "trip_builder.read",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const data = await getTripDetail(tripId, { memberId: session.memberId });
    return noStore(apiSuccess(data));
  },
);
