import {
  clientIdSchema,
  clientMessages,
  createClientPreferenceSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createClientPreference, getClientProfile } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Add a preference for a client. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const body = createClientPreferenceSchema.parse(await request.json());

    await createClientPreference(clientId, body, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.preferenceCreated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
