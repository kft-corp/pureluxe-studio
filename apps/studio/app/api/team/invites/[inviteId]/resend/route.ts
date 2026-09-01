import { touchStudioInvite } from "@pureluxe/db";
import { AppError, teamMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";

type RouteContext = {
  params: Promise<{ inviteId: string }>;
};

/** Refresh a pending invite timestamp. */
export async function POST(_request: Request, context: RouteContext) {
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

    const invite = await touchStudioInvite(inviteId);

    return apiSuccess(
      { id: invite.id },
      { message: teamMessages.success.inviteResent },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
