import {
  tripIdSchema,
  tripMessages,
  updateTripSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getTripDetail, updateTrip } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseTripId(context: RouteContext) {
  const { id } = await context.params;
  return tripIdSchema.parse(id);
}

/** Studio trip aggregate — assigned only. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.read");
    const tripId = await parseTripId(context);
    const data = await getTripDetail(tripId, { memberId: session.memberId });
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Patch trip shell fields; returns full detail. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const tripId = await parseTripId(context);
    const patch = updateTripSchema.parse(await request.json());
    const data = await updateTrip(tripId, patch, {
      memberId: session.memberId,
    });
    const response = apiSuccess(data, {
      message: tripMessages.success.updated,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
