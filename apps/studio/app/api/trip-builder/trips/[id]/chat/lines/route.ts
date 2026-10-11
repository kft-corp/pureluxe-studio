import {
  tripBuilderChatLinesSchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { saveTripChatLines } from "@/lib/trip-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Keep chip and pre-trip lines on the trip so a refresh does not drop them. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const { id } = await context.params;
    const tripId = tripIdSchema.parse(id);
    const body = tripBuilderChatLinesSchema.parse(await request.json());
    const data = await saveTripChatLines(tripId, body.lines, {
      memberId: session.memberId,
    });
    return apiSuccess(data, { message: tripMessages.success.chatListed });
  } catch (cause) {
    return apiFromError(cause);
  }
}
