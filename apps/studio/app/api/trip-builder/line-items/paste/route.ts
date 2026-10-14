import { pasteLineItemBodySchema, rateMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { pasteTripLineItem } from "@/lib/rates";

/** Paste quote → trip_line_items pending_review. */
export async function POST(request: Request) {
  try {
    const session = await requireApiPermission("trip_builder.write");
    const input = pasteLineItemBodySchema.parse(await request.json());
    const data = await pasteTripLineItem(input, {
      memberId: session.memberId,
    });

    return apiSuccess(data, {
      status: 201,
      message: rateMessages.success.pasteCreated,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
