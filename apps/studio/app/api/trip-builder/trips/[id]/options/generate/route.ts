import { generateTripQuoteSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { generateOptionsQuotePdf } from "@/lib/trip-builder";

/** Generate the options quote PDF from the rooms saved for the client. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const body = await request.json().catch(() => ({}));
    const input = generateTripQuoteSchema.parse(body ?? {});
    const detail = await generateOptionsQuotePdf(tripId, input, { memberId: session.memberId });
    return apiSuccess(detail, { message: tripMessages.success.quoteGenerated });
  },
);
