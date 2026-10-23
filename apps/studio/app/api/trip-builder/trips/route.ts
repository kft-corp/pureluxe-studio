import { listTripsQuerySchema, tripMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { listTripBuilderTrips } from "@/lib/trip-builder";

function queryFromUrl(url: URL) {
  return listTripsQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
}

/** Assigned trips — Trip Builder home / switcher. */
export const GET = apiRoute("trip_builder.read", async ({ request, session }) => {
  const query = queryFromUrl(new URL(request.url));
  const data = await listTripBuilderTrips(query, { memberId: session.memberId });
  return noStore(apiSuccess(data, { message: tripMessages.success.listed }));
});
