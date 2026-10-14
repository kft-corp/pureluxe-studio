import { searchClientsQuerySchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { searchClients } from "@/lib/clients";

const NO_STORE = "no-store, no-cache, must-revalidate";

/** Autocomplete — max 10 results for Trip Builder / mid-call lookup. */
export async function GET(request: Request) {
  try {
    await requireApiPermission("clients.read");
    const url = new URL(request.url);
    const query = searchClientsQuerySchema.parse({
      q: url.searchParams.get("q") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    const data = await searchClients(query);
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
