import { rateMessages, tripLineItemIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { selectAccommodationRate } from "@/lib/trip-builder";

/** Select a priced accommodation rate for its stay leg. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ params, session }) => {
    const lineItemId = tripLineItemIdSchema.parse(params.id);
    const data = await selectAccommodationRate(lineItemId, { memberId: session.memberId });
    return apiSuccess(data, { message: rateMessages.success.rateSelected });
  },
);
