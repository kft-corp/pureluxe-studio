import {
  findTeamMemberById,
  updateTeamMember,
} from "@pureluxe/db";
import {
  AppError,
  teamMessages,
  updateMemberRoleSchema,
  updateMemberStatusSchema,
} from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { assertActiveRole } from "@/lib/team/team-overview";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

/** Update a team member role or active status. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await requireApiPermission("team.manage");
    const { memberId } = await context.params;
    const body: unknown = await request.json();

    const member = await findTeamMemberById(memberId);

    if (!member) {
      throw new AppError({
        userMessage: teamMessages.error.memberNotFound,
        code: "team.member_not_found",
        status: 404,
      });
    }

    if (typeof body === "object" && body !== null && "role" in body) {
      const { role } = updateMemberRoleSchema.parse(body);

      if (memberId === session.memberId) {
        throw new AppError({
          userMessage: teamMessages.error.cannotChangeOwnRole,
          code: "team.cannot_change_own_role",
          status: 400,
        });
      }

      await assertActiveRole(role);
      const updated = await updateTeamMember({ memberId, role });

      return apiSuccess(
        { id: updated.id, role: updated.role },
        { message: teamMessages.success.roleUpdated },
      );
    }

    if (typeof body === "object" && body !== null && "active" in body) {
      const { active } = updateMemberStatusSchema.parse(body);

      if (!active && memberId === session.memberId) {
        throw new AppError({
          userMessage: teamMessages.error.cannotDeactivateSelf,
          code: "team.cannot_deactivate_self",
          status: 400,
        });
      }

      const updated = await updateTeamMember({ memberId, active });

      return apiSuccess(
        { id: updated.id, active: updated.active },
        {
          message: active
            ? teamMessages.success.memberReactivated
            : teamMessages.success.memberDeactivated,
        },
      );
    }

    throw new AppError({
      userMessage: teamMessages.error.memberNotFound,
      code: "team.invalid_update",
      status: 400,
    });
  } catch (cause) {
    return apiFromError(cause);
  }
}
