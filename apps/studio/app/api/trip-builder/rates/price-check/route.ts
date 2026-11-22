import { priceCheckBodySchema, rateMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { recheckChosenRate } from "@/lib/trip-builder/rates/recheck-chosen-rate";

/**
 * Recheck today's price for a chosen / named room.
 * GDS → live Sabre Price Check. Contracted / pasted → skip with a clear note.
 */
export const POST = apiRoute("trip_builder.read", async ({ request, session }) => {
  const input = priceCheckBodySchema.parse(await request.json());
  const data = await recheckChosenRate(
    {
      tripId: input.trip_id,
      lineItemId: input.line_item_id,
      hotel: input.hotel,
      room: input.room,
    },
    { memberId: session.memberId },
  );
  return apiSuccess(data, { message: rateMessages.success.priceChecked });
});
