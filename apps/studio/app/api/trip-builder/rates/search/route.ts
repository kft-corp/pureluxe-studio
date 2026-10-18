import { rateMessages, searchRatesBodySchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { searchTripRates } from "@/lib/trip-builder";

/**
 * Run Rate Layer search for a trip leg (thin → @pureluxe/rates).
 * When trip_id is set, ownership is enforced inside searchTripRates.
 */
export const POST = apiRoute("rates.search", async ({ request, session }) => {
  const input = searchRatesBodySchema.parse(await request.json());
  const data = await searchTripRates(input, { memberId: session.memberId });
  return apiSuccess(data, { message: rateMessages.success.searched });
});
