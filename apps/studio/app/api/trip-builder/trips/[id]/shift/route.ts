import {
  shiftTripDatesSchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { shiftTripDates } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Move the trip and every stay by the same number of days. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const { days } = shiftTripDatesSchema.parse(await request.json());
    const data = await shiftTripDates(tripId, days, { memberId: session.memberId });
    const response = apiSuccess(data, { message: tripMessages.success.datesShifted });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
