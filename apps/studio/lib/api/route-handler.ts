import { requireApiPermission } from "@/lib/auth/require-api-permission";

import { apiFromError } from "./responses";

/**
 * Server-only helpers for API route handlers. Import from "@/lib/api/route-handler",
 * not from "@/lib/api": that index is also loaded by client components.
 */

export type ApiSession = Awaited<ReturnType<typeof requireApiPermission>>;

type RouteArgs<Params> = {
  request: Request;
  params: Params;
  session: ApiSession;
};

const NO_STORE = "no-store, no-cache, must-revalidate";

/**
 * Wraps a route handler: checks the permission, awaits the URL params, and turns
 * any throw (AppError, Zod, bad JSON) into the standard error envelope.
 */
export function apiRoute<Params extends Record<string, string> = Record<string, string>>(
  permission: string,
  handler: (args: RouteArgs<Params>) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<Params> }): Promise<Response> => {
    try {
      const session = await requireApiPermission(permission);
      const params = await context.params;
      return await handler({ request, params, session });
    } catch (cause) {
      return apiFromError(cause);
    }
  };
}

/** Stops browsers and proxies caching a response that changes with every edit. */
export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", NO_STORE);
  return response;
}

/** Streams NDJSON events (one JSON object per line) to the chat UI. */
export function ndjsonResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": NO_STORE,
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
