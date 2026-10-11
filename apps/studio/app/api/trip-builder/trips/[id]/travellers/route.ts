import { addTripTravellerSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { addTripTraveller, changeTripLead, confirmTripTravellers } from "@/lib/trip-builder";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Add a companion, confirm the party, or make another client the lead. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const body = (await request.json()) as { confirm?: unknown; lead_client_id?: unknown };
    const data =
      body.confirm === true
        ? await confirmTripTravellers(tripId, { memberId: session.memberId })
        : typeof body.lead_client_id === "string"
          ? await changeTripLead(
              tripId,
              addTripTravellerSchema.parse({ client_id: body.lead_client_id }).client_id,
              { memberId: session.memberId },
            )
          : await addTripTraveller(tripId, addTripTravellerSchema.parse(body), {
              memberId: session.memberId,
            });
    const response = apiSuccess(data, { message: tripMessages.success.updated });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
