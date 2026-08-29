import type { StudioRole } from "@pureluxe/db";

import type { StudioSessionData } from "./types";

/** True when the session has a signed-in team member. */
export function isStudioSessionActive(
  session: StudioSessionData,
): session is StudioSessionData & {
  isLoggedIn: true;
  memberId: string;
  email: string;
  name: string;
  role: StudioRole;
} {
  return Boolean(
    session.isLoggedIn &&
      session.memberId &&
      session.email &&
      session.name &&
      session.role,
  );
}
