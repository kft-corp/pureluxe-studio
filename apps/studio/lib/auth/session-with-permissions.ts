import { cache } from "react";

import {
  isStudioSessionActive,
  type StudioSessionData,
} from "@pureluxe/auth";
import { listPermissionSlugsByRole } from "@pureluxe/db";

import { loadStudioSession } from "@/lib/auth/session";

/**
 * Session with permissions loaded from DB when missing from the cookie.
 * Returns a plain session snapshot — never mutates or saves cookies (Server Components).
 */
export const loadStudioSessionWithPermissions = cache(
  async (): Promise<StudioSessionData> => {
    const session = await loadStudioSession();

    if (!isStudioSessionActive(session)) {
      return session;
    }

    if (session.permissions !== undefined) {
      return session;
    }

    const permissions = await listPermissionSlugsByRole(session.role);

    return {
      isLoggedIn: session.isLoggedIn,
      memberId: session.memberId,
      email: session.email,
      name: session.name,
      role: session.role,
      permissions,
    };
  },
);

export type ActiveStudioSession = StudioSessionData & {
  isLoggedIn: true;
  memberId: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

/** Active session guaranteed to include permissions array (may be empty). */
export async function requireActiveStudioSession(): Promise<ActiveStudioSession> {
  const session = await loadStudioSessionWithPermissions();

  if (!isStudioSessionActive(session)) {
    throw new Error("Studio session is not active");
  }

  return {
    ...session,
    permissions: session.permissions ?? [],
  };
}
