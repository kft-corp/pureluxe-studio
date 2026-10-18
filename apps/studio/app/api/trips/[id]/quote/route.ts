import { tripIdSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { getJourneyQuoteUrl } from "@/lib/trips";

/** Short-lived signed URL for the quote PDF on the trip page. */
export const GET = apiRoute<{ id: string }>("trips.read", async ({ request, params }) => {
  const tripId = tripIdSchema.parse(params.id);
  const download = new URL(request.url).searchParams.get("download") === "1";
  const data = await getJourneyQuoteUrl(tripId, download);
  return apiSuccess(data);
});
