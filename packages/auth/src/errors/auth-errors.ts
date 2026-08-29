import { AppError, authMessages } from "@pureluxe/shared";

/** Auth env missing or invalid on the server. */
export function authConfigError(cause?: unknown): AppError {
  return new AppError({
    userMessage: authMessages.error.signInFailed,
    code: "auth.config_invalid",
    status: 503,
    cause,
  });
}

/** Email not invited and no pending invite. */
export function accessDeniedError(): AppError {
  return new AppError({
    userMessage: authMessages.error.accessDenied,
    code: "auth.access_denied",
    status: 403,
  });
}

/** Team member exists but active = false. */
export function accountInactiveError(): AppError {
  return new AppError({
    userMessage: authMessages.error.accountInactive,
    code: "auth.account_inactive",
    status: 403,
  });
}

/** Google returned no usable email. */
export function googleProfileError(cause?: unknown): AppError {
  return new AppError({
    userMessage: authMessages.error.signInFailed,
    code: "auth.google_profile_invalid",
    status: 502,
    cause,
  });
}
