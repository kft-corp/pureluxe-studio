import { tripIdSchema, tripMessages, updateOptionsQuoteSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { updateOptionsQuote } from "@/lib/trip-builder/options-quote";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Edit the title or note on the options quote. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const input = updateOptionsQuoteSchema.parse(await request.json());
    const detail = await updateOptionsQuote(tripId, input, {
      memberId: session.memberId,
    });
    return apiSuccess(detail, { message: tripMessages.success.quoteSaved });
  } catch (cause) {
    return apiFromError(cause);
  }
}
