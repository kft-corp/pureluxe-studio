import {
  generateTripQuoteSchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { generateTripQuotePdf } from "@/lib/trip-builder";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Generate (or regenerate) the quote PDF for the trip. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const body = await request.json().catch(() => ({}));
    const input = generateTripQuoteSchema.parse(body ?? {});
    const data = await generateTripQuotePdf(tripId, input, {
      memberId: session.memberId,
    });

    return apiSuccess(data, {
      message: tripMessages.success.quoteGenerated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
