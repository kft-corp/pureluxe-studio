import {
  tripBuilderChatListQuerySchema,
  tripBuilderChatSendSchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiSuccess } from "@/lib/api";
import { apiRoute, ndjsonResponse, noStore } from "@/lib/api/route-handler";
import {
  createChatStream,
  listChatMessages,
  prepareChatTurn,
} from "@/lib/trip-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Seconds. An agent reply with several lookups takes 20–60 s; saved progress covers the rest. */
export const maxDuration = 60;

/** List a recent page of studio chat messages for an assigned trip. */
export const GET = apiRoute<{ id: string }>(
  "trip_builder.read",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const url = new URL(request.url);
    const query = tripBuilderChatListQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      before: url.searchParams.get("before") ?? undefined,
    });
    const data = await listChatMessages(tripId, { memberId: session.memberId }, query);
    return noStore(apiSuccess(data, { message: tripMessages.success.chatListed }));
  },
);

/**
 * Send a studio chat message and stream the assistant reply (NDJSON).
 * Persists user (+ assistant when complete). Idempotent via client_request_id.
 */
export const POST = apiRoute<{ id: string }>(
  "trip_builder.write",
  async ({ request, params, session }) => {
    const tripId = tripIdSchema.parse(params.id);
    const body = tripBuilderChatSendSchema.parse(await request.json());
    const prepared = await prepareChatTurn(tripId, body, {
      memberId: session.memberId,
      permissions: session.permissions,
    });
    return ndjsonResponse(createChatStream(prepared));
  },
);
