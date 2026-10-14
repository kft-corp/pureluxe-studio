import {
  rateMessages,
  updateRateSourcesSettingSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { getRateSources, patchRateSourcesSetting } from "@/lib/rates";

const NO_STORE = "no-store, no-cache, must-revalidate";

/** Company rate_sources toggles only (not destination lists). */
export async function GET() {
  try {
    await requireApiPermission("settings.rate_sources");
    const data = await getRateSources();
    const response = apiSuccess(data, {
      message: rateMessages.success.settingsLoaded,
    });
    response.headers.set("Cache-Control", NO_STORE);
    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}

/** Patch company rate_sources toggles. */
export async function PATCH(request: Request) {
  try {
    const session = await requireApiPermission("settings.rate_sources");
    const input = updateRateSourcesSettingSchema.parse(await request.json());
    const rate_sources = await patchRateSourcesSetting(input, {
      memberId: session.memberId,
    });

    return apiSuccess(
      { rate_sources },
      { message: rateMessages.success.settingsSaved },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
