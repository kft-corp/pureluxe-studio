import { rateMessages, tripLineItemIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { rejectTripLineItem } from "@/lib/rates";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** pending_review → rejected. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const lineItemId = tripLineItemIdSchema.parse(id);
    const data = await rejectTripLineItem(lineItemId);

    return apiSuccess(data, {
      message: rateMessages.success.rejected,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
