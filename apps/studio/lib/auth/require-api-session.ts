import { isStudioSessionActive } from "@pureluxe/auth";
import { AppError, authMessages } from "@pureluxe/shared";

import { loadStudioSession } from "@/lib/auth/session";

/** Active session for API route handlers. */
export async function requireApiStudioSession() {
  const session = await loadStudioSession();

  if (!isStudioSessionActive(session)) {
    throw new AppError({
      userMessage: authMessages.warn.sessionExpired,
      code: "auth.session_required",
      status: 401,
    });
  }

  return session;
}
