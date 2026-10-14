import { replaceRolePermissions } from "@pureluxe/db";
import { teamMessages, updateRolePermissionsSchema } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { requireApiPermission } from "@/lib/auth/require-api-permission";
import { assertActiveRole } from "@/lib/team/team-overview";

type RouteContext = {
  params: Promise<{ role: string }>;
};

/** Replace permission grants for one role. */
export async function PUT(request: Request, context: RouteContext) {
  try {
    await requireApiPermission("team.manage");
    const { role } = await context.params;
    const body: unknown = await request.json();
    const { permissionSlugs } = updateRolePermissionsSchema.parse(body);

    await assertActiveRole(role);
    const saved = await replaceRolePermissions(role, permissionSlugs);

    return apiSuccess(
      { role, permissionSlugs: saved },
      { message: teamMessages.success.permissionsUpdated },
    );
  } catch (cause) {
    return apiFromError(cause);
  }
}
