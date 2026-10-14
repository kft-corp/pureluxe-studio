import { searchFamiliesQuerySchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { searchClientFamilies } from "@/lib/clients";

/** Search households by name — max 10 for join UX. */
export async function GET(request: Request) {
  try {
    await requireApiPermission("clients.read");
    const url = new URL(request.url);
    const query = searchFamiliesQuerySchema.parse({
      q: url.searchParams.get("q") ?? "",
    });

    const families = await searchClientFamilies(query.q);

    return apiSuccess({ families });
  } catch (cause) {
    return apiFromError(cause);
  }
}
