import { addRateOptionBodySchema, rateMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { attachRateOption } from "@/lib/trip-builder";

/** Persist a search option onto the trip (optionally select it). */
export const POST = apiRoute("trip_builder.write", async ({ request, session }) => {
  const input = addRateOptionBodySchema.parse(await request.json());
  const data = await attachRateOption(input, { memberId: session.memberId });
  return apiSuccess(data, {
    status: 201,
    message: input.select ? rateMessages.success.rateSelected : rateMessages.success.rateAdded,
  });
});
