import { generateTripQuoteSchema, tripIdSchema, tripMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { generateOptionsQuotePdf } from "@/lib/trip-builder/options-quote";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Generate the options quote PDF from the rooms saved for the client. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const body = await request.json().catch(() => ({}));
    const input = generateTripQuoteSchema.parse(body ?? {});
    const detail = await generateOptionsQuotePdf(tripId, input, {
      memberId: session.memberId,
    });
    return apiSuccess(detail, { message: tripMessages.success.quoteGenerated });
  } catch (cause) {
    return apiFromError(cause);
  }
}
