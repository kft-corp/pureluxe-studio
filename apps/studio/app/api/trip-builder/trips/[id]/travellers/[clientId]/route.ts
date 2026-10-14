import { tripIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { removeTripTraveller } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string; clientId: string }>;
};

/** Remove a companion from the trip. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id, clientId } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const companionId = tripIdSchema.parse(clientId);
    const data = await removeTripTraveller(tripId, companionId, {
      memberId: session.memberId,
    });
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
