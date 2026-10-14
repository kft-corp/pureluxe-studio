import {
  clientIdSchema,
  clientMessages,
  upsertClientHealthSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getClientProfile, upsertClientHealth } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Upsert health & accessibility details for a client. */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const body = upsertClientHealthSchema.parse(await request.json());

    await upsertClientHealth(clientId, body, { memberId: session.memberId });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.healthUpdated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
