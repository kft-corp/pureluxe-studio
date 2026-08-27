/** Database and server setup copy — user-safe, no tech details. */
export const dbMessages = {
  error: {
    dbUnavailable:
      "We couldn't reach the server. Please try again in a moment.",
    dbSetupIncomplete:
      "Studio isn't fully set up yet. Contact your administrator.",
  },
} as const;
