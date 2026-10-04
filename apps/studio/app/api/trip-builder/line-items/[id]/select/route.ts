import { rateMessages, tripLineItemIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { selectTripAccommodationLineItem } from "@/lib/rates";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Select a priced accommodation rate for its stay leg. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const lineItemId = tripLineItemIdSchema.parse(id);
    const data = await selectTripAccommodationLineItem(lineItemId, {
      memberId: session.memberId,
    });

    return apiSuccess(data, {
      message: rateMessages.success.rateSelected,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
