import { revokeStudioInvite } from "@pureluxe/db";
import { AppError, teamMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";

type RouteContext = {
  params: Promise<{ inviteId: string }>;
};

/** Revoke a pending invite. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireApiPermission("team.manage");
    const { inviteId } = await context.params;

    if (!inviteId) {
      throw new AppError({
        userMessage: teamMessages.error.inviteNotFound,
        code: "team.invite_not_found",
        status: 404,
      });
    }

    await revokeStudioInvite(inviteId);

    return apiSuccess(
      { id: inviteId },
      { message: teamMessages.success.inviteRevoked },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
