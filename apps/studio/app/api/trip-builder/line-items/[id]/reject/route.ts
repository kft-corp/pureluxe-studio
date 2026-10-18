import { rateMessages, tripLineItemIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { rejectTripLineItem } from "@/lib/trip-builder";

/** pending_review → rejected. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ params, session }) => {
    const lineItemId = tripLineItemIdSchema.parse(params.id);
    const data = await rejectTripLineItem(lineItemId, { memberId: session.memberId });
    return apiSuccess(data, { message: rateMessages.success.rejected });
  },
);
