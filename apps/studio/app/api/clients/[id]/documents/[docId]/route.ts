import {
  clientIdSchema,
  clientMessages,
  documentIdSchema,
  updateClientDocumentSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import {
  deleteClientDocument,
  getClientProfile,
  updateClientDocument,
} from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string; docId: string }>;
};

/** Update document metadata or verification status. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id, docId } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const documentId = documentIdSchema.parse(docId);
    const body = updateClientDocumentSchema.parse(await request.json());

    await updateClientDocument(clientId, documentId, body, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    let message: string = clientMessages.success.documentUpdated;
    if (body.status === "verified") {
      message = clientMessages.success.documentVerified;
    } else if (body.status === "rejected") {
      message = clientMessages.success.documentRejected;
    }

    return apiSuccess(profile, { message });
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Remove a document and its storage object. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id, docId } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const documentId = documentIdSchema.parse(docId);

    await deleteClientDocument(clientId, documentId, {
      memberId: session.memberId,
    });
    const profile = await getClientProfile(clientId);

    return apiSuccess(profile, {
      message: clientMessages.success.documentRemoved,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
