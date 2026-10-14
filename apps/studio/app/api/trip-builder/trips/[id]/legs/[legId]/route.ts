import {
  tripIdSchema,
  tripMessages,
  updateTripLegSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { removeTripLeg, reviseTripLeg } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string; legId: string }>;
};

async function ids(context: RouteContext) {
  const { id, legId } = await context.params;
  return {
    tripId: tripIdSchema.parse(id),
    legId: tripIdSchema.parse(legId),
  };
}

/** Change city and dates on one stay. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { tripId, legId } = await ids(context);
    const input = updateTripLegSchema.parse(await request.json());
    const data = await reviseTripLeg(tripId, legId, input, {
      memberId: session.memberId,
    });
    const response = apiSuccess(data, {
      message: tripMessages.success.legUpdated,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Remove one stay and cancel its pending booking. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { tripId, legId } = await ids(context);
    const data = await removeTripLeg(tripId, legId, {
      memberId: session.memberId,
    });
    const response = apiSuccess(data, {
      message: tripMessages.success.legRemoved,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
