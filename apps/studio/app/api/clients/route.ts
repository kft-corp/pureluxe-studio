import {
  clientMessages,
  createClientSchema,
  listClientsQuerySchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createClient, listClientDirectory } from "@/lib/clients";

const NO_STORE = "no-store, no-cache, must-revalidate";

function queryFromUrl(url: URL) {
  const filtersRaw = url.searchParams.getAll("filters");
  const sourcesRaw = url.searchParams.getAll("sources");

  return listClientsQuerySchema.parse({
    q: url.searchParams.get("q") ?? undefined,
    filters: filtersRaw.length ? filtersRaw : (url.searchParams.get("filters") ?? undefined),
    tier: url.searchParams.get("tier") ?? undefined,
    review_status: url.searchParams.get("review_status") ?? undefined,
    has_family: url.searchParams.get("has_family") ?? undefined,
    missing_contact: url.searchParams.get("missing_contact") ?? undefined,
    owner: url.searchParams.get("owner") ?? undefined,
    sources: sourcesRaw.length ? sourcesRaw : (url.searchParams.get("sources") ?? undefined),
    completeness: url.searchParams.get("completeness") ?? undefined,
    created_from: url.searchParams.get("created_from") ?? undefined,
    created_to: url.searchParams.get("created_to") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
}

/** Directory — search, chips + advanced filters, sort, paginate. */
export async function GET(request: Request) {
  try {
    const session = await requireApiPermission("clients.read");
    const query = queryFromUrl(new URL(request.url));
    const data = await listClientDirectory({
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

/** Create client — pending until manually approved. */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("clients.write");
    const input = createClientSchema.parse(await request.json());
    const data = await createClient(input, { memberId: session.memberId });
    return apiSuccess(data, {
      status: 201,
      message: clientMessages.success.created,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
