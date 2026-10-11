import { proposeOptionsQuoteEditSchema, tripIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { proposeOptionsQuoteEdit } from "@/lib/trip-builder/options-quote-edit";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Read the options quote and propose a wording change. Nothing is saved. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const input = proposeOptionsQuoteEditSchema.parse(await request.json());
    const proposal = await proposeOptionsQuoteEdit(tripId, input.message, {
      memberId: session.memberId,
    });
    return apiSuccess(proposal);
  } catch (cause) {
    return apiFromError(cause);
  }
}
