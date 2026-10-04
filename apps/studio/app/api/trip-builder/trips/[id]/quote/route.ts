import {
  tripIdSchema,
  tripMessages,
  updateTripQuoteSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getTripQuote, updateTripQuote } from "@/lib/trip-builder";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Load quote draft + document status. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.read");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const data = await getTripQuote(tripId, { memberId: session.memberId });

    return apiSuccess(data, {
      message: tripMessages.success.quoteLoaded,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Edit quote draft (narrative + optional sell fields). */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const input = updateTripQuoteSchema.parse(await request.json());
    const data = await updateTripQuote(tripId, input, {
      memberId: session.memberId,
    });

    return apiSuccess(data, {
      message: tripMessages.success.quoteSaved,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
