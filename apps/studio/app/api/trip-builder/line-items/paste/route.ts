import { pasteLineItemBodySchema, rateMessages } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { pasteTripLineItem } from "@/lib/trip-builder";

/** Paste quote → trip_line_items pending_review. */
export const POST = apiRoute("trip_builder.write", async ({ request, session }) => {
  const input = pasteLineItemBodySchema.parse(await request.json());
  const data = await pasteTripLineItem(input, { memberId: session.memberId });
  return apiSuccess(data, { status: 201, message: rateMessages.success.pasteCreated });
});
