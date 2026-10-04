import {
  setTripStaySchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { setTripStay } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Set Phase 1 fixed stay — hotel + city + dates. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const input = setTripStaySchema.parse(await request.json());
    const data = await setTripStay(tripId, input, {
      memberId: session.memberId,
    });
    const response = apiSuccess(data, {
      message: tripMessages.success.staySaved,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
