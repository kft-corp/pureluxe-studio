import {
  clientIdSchema,
  clientMessages,
  createClientRelationshipSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createClientRelationship, getClientProfile } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** Link a non-household related person. */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const body = createClientRelationshipSchema.parse(await request.json());

    await createClientRelationship(clientId, body, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.relationshipCreated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
