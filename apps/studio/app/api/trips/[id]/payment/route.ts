import {
  tripIdSchema,
  tripMessages,
  updateTripPaymentSchema,
} from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { updateTripPayment } from "@/lib/trips/update-trip-payment";

/** Record offline client payment on a trip. */
export const PATCH = apiRoute<{ id: string }>(
  "trips.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const body = updateTripPaymentSchema.parse(await request.json());
    const journey = await updateTripPayment(tripId, body, {
      memberId: session.memberId,
    });
    return apiSuccess(journey, { message: tripMessages.success.paymentUpdated });
  },
);
