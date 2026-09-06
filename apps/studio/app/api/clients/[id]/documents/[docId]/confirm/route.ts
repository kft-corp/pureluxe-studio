import {
  clientIdSchema,
  clientMessages,
  documentIdSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  confirmClientDocumentUpload,
  getClientProfile,
} from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string; docId: string }>;
};

/** After storage upload succeeds — move pending_upload → pending_review. */
export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id, docId } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const documentId = documentIdSchema.parse(docId);

    await confirmClientDocumentUpload(clientId, documentId, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.documentCreated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
