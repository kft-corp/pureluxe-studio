// API paths. Match app/api folders. Call via lib/api helpers, not raw strings.
export const apiRoutes = {
  auth: {
    prefix: "/api/auth",
    google: "/api/auth/google",
    callback: "/api/auth/callback",
    logout: "/api/auth/logout",
  },
} as const;
