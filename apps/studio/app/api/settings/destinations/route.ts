import { rateMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getDestinationsSettings } from "@/lib/rates";

const NO_STORE = "no-store, no-cache, must-revalidate";

/** Destination profiles + type defaults for Rate Layer Settings. */
export async function GET() {
  try {
    await requireApiPermission("settings.rate_sources");
    const data = await getDestinationsSettings();
    const response = apiSuccess(data, {
      message: rateMessages.success.destinationsLoaded,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
