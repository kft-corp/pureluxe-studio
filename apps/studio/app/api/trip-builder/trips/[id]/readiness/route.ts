import { tripIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getTripReadiness } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Things to sort out before booking (passport, visa, child ages, hotel notes). */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.read");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const readiness = await getTripReadiness(tripId, { memberId: session.memberId });
    const response = apiSuccess({ readiness });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
