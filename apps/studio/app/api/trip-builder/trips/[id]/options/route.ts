import { tripIdSchema, tripMessages, updateOptionsQuoteSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { updateOptionsQuote } from "@/lib/trip-builder";

/** Edit the title or note on the options quote. */
export const PATCH = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const input = updateOptionsQuoteSchema.parse(await request.json());
    const detail = await updateOptionsQuote(tripId, input, { memberId: session.memberId });
    return apiSuccess(detail, { message: tripMessages.success.quoteSaved });
  },
);
