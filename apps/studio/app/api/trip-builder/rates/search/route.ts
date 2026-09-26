import { rateMessages, searchRatesBodySchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { runRateSearch } from "@/lib/rates";

/** Run Rate Layer resolver for a trip leg (thin → @pureluxe/rates). */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("rates.search");
    const input = searchRatesBodySchema.parse(await request.json());
    const data = await runRateSearch(input, { memberId: session.memberId });

    return apiSuccess(data, {
      message: rateMessages.success.searched,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
