import { listPermissionSlugsByRole } from "@pureluxe/db";
import {
  AppError,
  commonMessages,
  hasPermission,
} from "@pureluxe/shared";

import { requireApiStudioSession } from "@/lib/auth/require-api-session";

/** Active session with permissions loaded from DB when missing from cookie. */
export async function requireApiSessionWithPermissions() {
  const session = await requireApiStudioSession();
  const permissions =
    session.permissions ?? (await listPermissionSlugsByRole(session.role));

  return {
    ...session,
    permissions,
  };
}

/** Require a specific permission slug for API route handlers. */
export async function requireApiPermission(permission: string) {
  const session = await requireApiSessionWithPermissions();

  if (!hasPermission(session.permissions, permission)) {
    throw new AppError({
      userMessage: commonMessages.error.forbidden,
      code: "auth.forbidden",
      status: 403,
    });
  }

  return session;
}
