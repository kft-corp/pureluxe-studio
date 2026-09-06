import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getClientDirectoryFilters } from "@/lib/clients";

const NO_STORE = "no-store, no-cache, must-revalidate";

/** Filter catalog for the Clients directory panel — ready when the page opens. */
export async function GET() {
  try {
    await requireApiPermission("clients.read");
    const data = await getClientDirectoryFilters();
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
