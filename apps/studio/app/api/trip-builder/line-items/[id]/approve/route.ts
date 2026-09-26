import { rateMessages, tripLineItemIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { approveTripLineItem } from "@/lib/rates";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** pending_review → pending. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const lineItemId = tripLineItemIdSchema.parse(id);
    const data = await approveTripLineItem(lineItemId);

    return apiSuccess(data, {
      message: rateMessages.success.approved,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
