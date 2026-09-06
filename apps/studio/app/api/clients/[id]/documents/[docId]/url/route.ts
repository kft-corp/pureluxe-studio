import { clientIdSchema, documentIdSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getClientDocumentFileUrl } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string; docId: string }>;
};

/** Short-lived signed URL to view or download the document file. */
export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireApiPermission("clients.read");
    const { id, docId } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const documentId = documentIdSchema.parse(docId);

    const file = await getClientDocumentFileUrl(clientId, documentId);

    return apiSuccess(file);
  } catch (cause) {
    return apiFromError(cause);
  }
}
