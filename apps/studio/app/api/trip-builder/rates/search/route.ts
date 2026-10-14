import { rateMessages, searchRatesBodySchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { searchTripRates } from "@/lib/rates";

/**
 * Run Rate Layer search for a trip leg (thin → @pureluxe/rates).
 * When trip_id is set, ownership is enforced inside searchTripRates.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("rates.search");
    const input = searchRatesBodySchema.parse(await request.json());
    const data = await searchTripRates(input, { memberId: session.memberId });

    return apiSuccess(data, {
      message: rateMessages.success.searched,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
