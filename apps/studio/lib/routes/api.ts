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
  clients: {
    root: "/api/clients",
    search: "/api/clients/search",
    filters: "/api/clients/filters",
    byId: (clientId: string) => `/api/clients/${clientId}`,
    health: (clientId: string) => `/api/clients/${clientId}/health`,
    approve: (clientId: string) => `/api/clients/${clientId}/approve`,
    preferences: (clientId: string) => `/api/clients/${clientId}/preferences`,
    preference: (clientId: string, preferenceId: string) =>
      `/api/clients/${clientId}/preferences/${preferenceId}`,
    documents: (clientId: string) => `/api/clients/${clientId}/documents`,
    document: (clientId: string, documentId: string) =>
      `/api/clients/${clientId}/documents/${documentId}`,
    documentConfirm: (clientId: string, documentId: string) =>
      `/api/clients/${clientId}/documents/${documentId}/confirm`,
    documentUrl: (clientId: string, documentId: string) =>
      `/api/clients/${clientId}/documents/${documentId}/url`,
    family: (clientId: string) => `/api/clients/${clientId}/family`,
    relationships: (clientId: string) =>
      `/api/clients/${clientId}/relationships`,
    relationship: (clientId: string, relationshipId: string) =>
      `/api/clients/${clientId}/relationships/${relationshipId}`,
  },
  families: {
    search: "/api/families/search",
  },
  team: {
    members: "/api/team/members",
    member: (memberId: string) => `/api/team/members/${memberId}`,
    invites: "/api/team/invites",
    invite: (inviteId: string) => `/api/team/invites/${inviteId}`,
    inviteResend: (inviteId: string) => `/api/team/invites/${inviteId}/resend`,
    roles: "/api/team/roles",
    role: (roleSlug: string) => `/api/team/roles/${roleSlug}`,
  },
} as const;
