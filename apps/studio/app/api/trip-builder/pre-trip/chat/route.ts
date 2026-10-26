import { tripBuilderPreTripChatSendSchema } from "@pureluxe/shared";

import { apiRoute, ndjsonResponse } from "@/lib/api/route-handler";
import { createPreTripChatStream } from "@/lib/trip-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Seconds. Hobby hard cap is 60; soft budget aborts earlier inside the stream. */
export const maxDuration = 60;

/**
 * Pre-trip home chat — real agent with client, history, and hotel tools.
 * Ephemeral (no trip row, no message persistence).
 */
export const POST = apiRoute("trip_builder.write", async ({ request, session }) => {
  const body = tripBuilderPreTripChatSendSchema.parse(await request.json());
  const actor = { memberId: session.memberId, permissions: session.permissions };
  return ndjsonResponse(createPreTripChatStream(body, actor));
});
