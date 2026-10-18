import { tripIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { getTripReadiness } from "@/lib/trip-builder";

/** Things to sort out before booking (passport, visa, child ages, hotel notes). */
export const GET = apiRoute<{ id: string }>(
  "trip_builder.read",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const readiness = await getTripReadiness(tripId, { memberId: session.memberId });
    return noStore(apiSuccess({ readiness }));
  },
);
