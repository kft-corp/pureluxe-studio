import { tripIdSchema, tripMessages, updateTripQuoteSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { getTripQuote, updateTripQuote } from "@/lib/trip-builder";

/** Load the quote draft (sell price and wording). */
export const GET = apiRoute<{ id: string }>(
  "trip_builder.read",
  async ({ params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const data = await getTripQuote(tripId, { memberId: session.memberId });
    return apiSuccess(data, { message: tripMessages.success.quoteLoaded });
  },
);

/** Edit quote draft (narrative + optional sell fields). */
export const PATCH = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const input = updateTripQuoteSchema.parse(await request.json());
    const data = await updateTripQuote(tripId, input, { memberId: session.memberId });
    return apiSuccess(data, { message: tripMessages.success.quoteSaved });
  },
);
