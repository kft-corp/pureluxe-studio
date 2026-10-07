import {
  tripBuilderChatListQuerySchema,
  tripBuilderChatSendSchema,
  tripIdSchema,
  tripMessages,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  createChatStream,
  listChatMessages,
  prepareChatTurn,
} from "@/lib/trip-builder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseTripId(context: RouteContext) {
  const { id } = await context.params;
  return tripIdSchema.parse(id);
}

/** List a recent page of studio chat messages for an assigned trip. */
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.read");
    const tripId = await parseTripId(context);
    const url = new URL(request.url);
    const query = tripBuilderChatListQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      before: url.searchParams.get("before") ?? undefined,
    });
    const data = await listChatMessages(
      tripId,
      { memberId: session.memberId },
      query,
    );
    const response = apiSuccess(data, {
      message: tripMessages.success.chatListed,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/**
 * Send a studio chat message and stream the assistant reply (NDJSON).
 * Persists user (+ assistant when complete). Idempotent via client_request_id.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const tripId = await parseTripId(context);
    const body = tripBuilderChatSendSchema.parse(await request.json());

    const prepared = await prepareChatTurn(tripId, body, {
      memberId: session.memberId,
    });

    return new Response(createChatStream(prepared), {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": NO_STORE,
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
