import { AppError, commonMessages, hasPermission } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiSessionWithPermissions } from "@/lib/auth/require-api-permission";
import { getTeamOverview } from "@/lib/team/team-overview";

/** Team members, pending invites, and active roles. */
export async function GET() {
  try {
    const session = await requireApiSessionWithPermissions();

    if (!hasPermission(session.permissions, "team.read")) {
      throw new AppError({
        userMessage: commonMessages.error.forbidden,
        code: "auth.forbidden",
        status: 403,
      });
    }

    const canManage = hasPermission(session.permissions, "team.manage");
    const overview = await getTeamOverview(canManage);
    const response = apiSuccess(overview);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    return response;
  } catch (cause) {
    return apiFromError(cause);
  }
}
