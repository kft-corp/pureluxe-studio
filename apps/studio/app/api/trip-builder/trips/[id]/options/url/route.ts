import { tripIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { getOptionsQuoteFileUrl } from "@/lib/trip-builder";

/** Short-lived signed URL for the options quote PDF. */
export const GET = apiRoute<{ id: string }>(
  "trip_builder.read",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const data = await getOptionsQuoteFileUrl(tripId, { memberId: session.memberId });
    return apiSuccess(data);
  },
);
