import { tripLineItemIdSchema, updateStayOptionSchema } from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { updateSavedStayOption } from "@/lib/trip-builder";

/** Edit the client price or wording on a room saved for the options quote. */
export const PATCH = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const lineItemId = tripLineItemIdSchema.parse(params.id);
    const input = updateStayOptionSchema.parse(await request.json());
    const detail = await updateSavedStayOption(lineItemId, input, { memberId: session.memberId });
    return apiSuccess(detail, { message: "Option saved." });
  },
);
