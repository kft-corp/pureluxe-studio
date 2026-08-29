import { authMessages } from "@pureluxe/shared";

import type { LoginErrorCode } from "./login-errors";

const LOGIN_ERROR_MESSAGES: Record<LoginErrorCode, string> = {
  access_denied: authMessages.error.accessDenied,
  inactive: authMessages.error.accountInactive,
  sign_in_failed: authMessages.error.signInFailed,
  sign_in_cancelled: authMessages.error.signInCancelled,
  session_expired: authMessages.warn.sessionExpired,
};

export function resolveLoginErrorMessage(error?: string): string | null {
  if (!error) return null;
  if (error in LOGIN_ERROR_MESSAGES) {
    return LOGIN_ERROR_MESSAGES[error as LoginErrorCode];
  }
  return authMessages.error.signInFailed;
}
