import { rateMessages, tripLineItemIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { approveTripLineItem } from "@/lib/trip-builder";

/** pending_review → pending. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ params, session }) => {
    const lineItemId = tripLineItemIdSchema.parse(params.id);
    const data = await approveTripLineItem(lineItemId, { memberId: session.memberId });
    return apiSuccess(data, { message: rateMessages.success.approved });
  },
);
