import { tripIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getJourneyQuoteUrl } from "@/lib/trips";

type RouteContext = { params: Promise<{ id: string }> };

/** Short-lived signed URL for the quote PDF on the trip page. */
export async function GET(request: Request, context: RouteContext) {
  try {
    await requireApiPermission("trips.read");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const data = await getJourneyQuoteUrl(tripId, download);
    return apiSuccess(data);
  } catch (cause) {
    return apiFromError(cause);
  }
}
