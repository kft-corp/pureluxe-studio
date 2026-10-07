import { tripBuilderPreTripChatSendSchema } from "@pureluxe/shared";

import { apiFromError } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createPreTripChatStream } from "@/lib/trip-builder/pre-trip-chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = "no-store, no-cache, must-revalidate";

/**
 * Pre-trip home chat — real agent with search_clients / get_client only.
 * Ephemeral (no trip row, no message persistence).
 */
export async function POST(request: Request) {
  try {
    await requireApiPermission("trip_builder.write");
    const body = tripBuilderPreTripChatSendSchema.parse(await request.json());

    return new Response(createPreTripChatStream(body), {
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
