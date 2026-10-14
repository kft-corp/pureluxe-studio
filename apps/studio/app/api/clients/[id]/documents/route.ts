import {
  clientIdSchema,
  clientMessages,
  createClientDocumentSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { createClientDocument } from "@/lib/clients";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Register a travel document (`pending_upload`) and return a signed upload URL.
 * After the file uploads, call confirm on the document route to move to pending_review.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("clients.write");
    const { id } = await context.params;
    const clientId = clientIdSchema.parse(id);
    const body = createClientDocumentSchema.parse(await request.json());

    const { document, upload } = await createClientDocument(clientId, body, {
      memberId: session.memberId,
    });

    return apiSuccess(
      {
        document,
        upload: {
          path: upload.path,
          signedUrl: upload.signedUrl,
          token: upload.token,
        },
      },
      {
        message: clientMessages.success.documentCreated,
      },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
