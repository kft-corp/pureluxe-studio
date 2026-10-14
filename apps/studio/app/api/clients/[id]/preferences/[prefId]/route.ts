import {
  clientIdSchema,
  clientMessages,
  preferenceIdSchema,
  updateClientPreferenceSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getClientProfile, updateClientPreference } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string; prefId: string }>;
};

/** Update, confirm, or deactivate a preference. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id, prefId } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const preferenceId = preferenceIdSchema.parse(prefId);
    const body = updateClientPreferenceSchema.parse(await request.json());

    await updateClientPreference(clientId, preferenceId, body, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    const message =
      body.active === false
        ? clientMessages.success.preferenceRemoved
        : body.is_confirmed === true
          ? clientMessages.success.preferenceConfirmed
          : clientMessages.success.preferenceUpdated;

    return apiSuccess(profile, {
      message,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
