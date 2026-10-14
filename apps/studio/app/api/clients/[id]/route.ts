import {
  clientIdSchema,
  clientMessages,
  updateClientSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  deactivateClient,
  getClientProfile,
  updateClient,
} from "@/lib/clients";

const NO_STORE = "no-store, no-cache, must-revalidate";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function parseClientId(context: RouteContext) {
  const { id } = await context.params;
  return clientIdSchema.parse(id);
}

/** Full profile for Studio. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireApiPermission("clients.read");
    const clientId = await parseClientId(context);
    const data = await getClientProfile(clientId);
    const response = apiSuccess(data);
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Update whitelisted profile fields. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const clientId = await parseClientId(context);
    const patch = updateClientSchema.parse(await request.json());
    const ifUnmodifiedSince = request.headers.get("If-Unmodified-Since");

    await updateClient(
      clientId,
      patch,
      { memberId: session.memberId },
      { ifUnmodifiedSince },
    );

    const profile = await getClientProfile(clientId);
    return apiSuccess(profile, {
      message: clientMessages.success.updated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Soft-deactivate (never hard-delete). */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const clientId = await parseClientId(context);
    const client = await deactivateClient(clientId, {
      memberId: session.memberId,
    });

    return apiSuccess(
      { id: client.id, active: client.active },
      { message: clientMessages.success.deactivated },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
