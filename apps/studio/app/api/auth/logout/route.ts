import { clearStudioSession } from "@pureluxe/auth";
import { authMessages } from "@pureluxe/shared";

import { apiFromError, apiSuccess } from "@/lib/api";
import { loadStudioSession } from "@/lib/auth/session";

// Sign out.
export async function POST() {
  try {
    const session = await loadStudioSession();
    clearStudioSession(session);
    await session.save();

    return apiSuccess(null, { message: authMessages.success.signedOut });
  } catch (cause) {
    return apiFromError(cause);
  }
}
