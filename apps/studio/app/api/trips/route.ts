import { listJourneysQuerySchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, noStore } from "@/lib/api/route-handler";
import { listJourneyDirectory } from "@/lib/trips";

function queryFromUrl(url: URL) {
  return listJourneysQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    scope: url.searchParams.get("scope") ?? undefined,
    stage: url.searchParams.get("stage") ?? undefined,
    client_tier: url.searchParams.get("client_tier") ?? undefined,
    price: url.searchParams.get("price") ?? undefined,
    quote: url.searchParams.get("quote") ?? undefined,
    owner: url.searchParams.get("owner") ?? undefined,
    starts_from: url.searchParams.get("starts_from") ?? undefined,
    starts_to: url.searchParams.get("starts_to") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
}

/** Trip board — who, when, where, and whether the guest is still planning or away. */
export const GET = apiRoute("trips.read", async ({ request, session }) => {
  const query = queryFromUrl(new URL(request.url));
  const data = await listJourneyDirectory({ ...query, actorMemberId: session.memberId });
  return noStore(apiSuccess(data));
});
