import { proposeOptionsQuoteEditSchema, tripIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { proposeOptionsQuoteEdit } from "@/lib/trip-builder";

/** Read the options quote and propose a wording change. Nothing is saved. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const input = proposeOptionsQuoteEditSchema.parse(await request.json());
    const proposal = await proposeOptionsQuoteEdit(tripId, input.message, {
      memberId: session.memberId,
    });
    return apiSuccess(proposal);
  },
);
