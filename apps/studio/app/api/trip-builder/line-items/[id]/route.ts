import { tripLineItemIdSchema, updateStayOptionSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { updateSavedStayOption } from "@/lib/trip-builder/options-quote";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Edit the client price or wording on a room saved for the options quote. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const lineItemId = tripLineItemIdSchema.parse(id);
    const input = updateStayOptionSchema.parse(await request.json());
    const detail = await updateSavedStayOption(lineItemId, input, {
      memberId: session.memberId,
    });
    return apiSuccess(detail, { message: "Option saved." });
  } catch (cause) {
    return apiFromError(cause);
  }
}
