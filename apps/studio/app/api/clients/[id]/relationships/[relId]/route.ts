import {
  clientIdSchema,
  clientMessages,
  relationshipIdSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { deleteClientRelationship, getClientProfile } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string; relId: string }>;
};

/** Remove a related-person link. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id, relId } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const relationshipId = relationshipIdSchema.parse(relId);

    await deleteClientRelationship(clientId, relationshipId, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.relationshipRemoved,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
