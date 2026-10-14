import { clientIdSchema, clientMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { approveClient, getClientProfile } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Pending → approved. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);

    await approveClient(clientId, { memberId: session.memberId });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.approved,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
