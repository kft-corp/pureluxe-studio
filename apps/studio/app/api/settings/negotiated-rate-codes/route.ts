import { rateMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getNegotiatedCodesSettings } from "@/lib/rates";

const NO_STORE = "no-store, no-cache, must-revalidate";

/** Negotiated / consortia GDS codes for Rate Layer Settings. */
export async function GET() {
  try {
    await requireApiPermission("settings.rate_sources");
    const data = await getNegotiatedCodesSettings();
    const response = apiSuccess(data, {
      message: rateMessages.success.negotiatedCodesLoaded,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
