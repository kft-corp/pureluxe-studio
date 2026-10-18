import { addTripTravellerSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { addTripTraveller, changeTripLead, confirmTripTravellers } from "@/lib/trip-builder";

/** Add a companion, confirm the party, or make another client the lead. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const actor = { memberId: session.memberId };
    const body = (await request.json()) as { confirm?: unknown; lead_client_id?: unknown };
    const data =
      body.confirm === true
        ? await confirmTripTravellers(tripId, actor)
        : typeof body.lead_client_id === "string"
          ? await changeTripLead(
              tripId,
              addTripTravellerSchema.parse({ client_id: body.lead_client_id }).client_id,
              actor,
            )
          : await addTripTraveller(tripId, addTripTravellerSchema.parse(body), actor);
    return noStore(apiSuccess(data, { message: tripMessages.success.updated }));
  },
);
