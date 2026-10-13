import { listJourneysQuerySchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { listJourneyDirectory } from "@/lib/trips";

const NO_STORE = "no-store, no-cache, must-revalidate";

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
export async function GET(request: Request) {
  try {
    const session = await requireApiPermission("trips.read");
    const query = queryFromUrl(new URL(request.url));
    const data = await listJourneyDirectory({
      ...query,
      actorMemberId: session.memberId,
    });
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
