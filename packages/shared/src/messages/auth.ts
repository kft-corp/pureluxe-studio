/** Sign-in and session copy — safe to show in UI. */
export const authMessages = {
  success: {
    signedIn: "Welcome back.",
    signedOut: "You have signed out.",
    inviteSent: "Invite sent. They can sign in with Google once they accept.",
  },
  warn: {
    sessionExpired: "Your session expired. Please sign in again.",
  },
  error: {
    accessDenied:
      "You don't have access to Studio. Ask an admin to invite your email.",
    accountInactive:
      "Your account is inactive. Contact an admin if you need access.",
    signInFailed: "Sign-in didn't work. Please try again.",
    signInCancelled: "Sign-in was cancelled. You can try again when ready.",
  },
} as const;
