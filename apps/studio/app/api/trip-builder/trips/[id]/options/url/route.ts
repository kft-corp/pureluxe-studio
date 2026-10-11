import { tripIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getOptionsQuoteFileUrl } from "@/lib/trip-builder/options-quote";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Short-lived signed URL for the options quote PDF. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.read");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const data = await getOptionsQuoteFileUrl(tripId, {
      memberId: session.memberId,
    });
    return apiSuccess(data);
  } catch (cause) {
    return apiFromError(cause);
  }
}
