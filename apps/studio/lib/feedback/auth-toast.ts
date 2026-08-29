import { authMessages } from "@pureluxe/shared";

import { resolveLoginErrorMessage } from "@/lib/auth/resolve-login-error";

import { showErrorToast, showSuccessToast, showWarningToast } from "./toast";

export function showLoginFeedbackToast(errorCode: string) {
  const message = resolveLoginErrorMessage(errorCode);
  if (!message) return;

  if (errorCode === "session_expired") {
    showWarningToast(message);
    return;
  }

  showErrorToast(message);
}

export function showSignedInToast() {
  showSuccessToast(authMessages.success.signedIn);
}
