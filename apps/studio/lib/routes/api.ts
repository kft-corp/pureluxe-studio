// API paths. Match app/api folders. Call via lib/api helpers, not raw strings.
export const apiRoutes = {
  account: {
    me: "/api/account/me",
  },
  auth: {
    prefix: "/api/auth",
    google: "/api/auth/google",
    callback: "/api/auth/callback",
    logout: "/api/auth/logout",
  },
  team: {
    members: "/api/team/members",
    member: (memberId: string) => `/api/team/members/${memberId}`,
    invites: "/api/team/invites",
    invite: (inviteId: string) => `/api/team/invites/${inviteId}`,
    inviteResend: (inviteId: string) => `/api/team/invites/${inviteId}/resend`,
  },
} as const;
