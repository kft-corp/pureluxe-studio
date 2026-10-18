import {
  tripBuilderChatLinesSchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute } from "@/lib/api/route-handler";
import { saveTripChatLines } from "@/lib/trip-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Keep chip and pre-trip lines on the trip so a refresh does not drop them. */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const body = tripBuilderChatLinesSchema.parse(await request.json());
    const data = await saveTripChatLines(tripId, body.lines, { memberId: session.memberId });
    return apiSuccess(data, { message: tripMessages.success.chatListed });
  },
);
