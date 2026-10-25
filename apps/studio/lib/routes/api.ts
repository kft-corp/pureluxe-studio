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
  bookings: {
    root: "/api/bookings",
    byId: (bookingId: string) => `/api/bookings/${bookingId}`,
    confirm: (bookingId: string) => `/api/bookings/${bookingId}/confirm`,
    cancel: (bookingId: string) => `/api/bookings/${bookingId}/cancel`,
    supersede: (bookingId: string) => `/api/bookings/${bookingId}/supersede`,
    delete: (bookingId: string) => `/api/bookings/${bookingId}/delete`,
    assign: (bookingId: string) => `/api/bookings/${bookingId}/assign`,
    trip: (bookingId: string) => `/api/bookings/${bookingId}/trip`,
    travellers: (bookingId: string) => `/api/bookings/${bookingId}/travellers`,
    traveller: (bookingId: string, travellerId: string) =>
      `/api/bookings/${bookingId}/travellers/${travellerId}`,
  },
  trips: {
    root: "/api/trips",
    status: (tripId: string) => `/api/trips/${tripId}/status`,
    quote: (tripId: string) => `/api/trips/${tripId}/quote`,
    payment: (tripId: string) => `/api/trips/${tripId}/payment`,
  },
  tripBuilder: {
    trips: "/api/trip-builder/trips",
    trip: (tripId: string) => `/api/trip-builder/trips/${tripId}`,
    stay: (tripId: string) => `/api/trip-builder/trips/${tripId}/stay`,
    readiness: (tripId: string) => `/api/trip-builder/trips/${tripId}/readiness`,
    quote: (tripId: string) => `/api/trip-builder/trips/${tripId}/quote`,
    options: (tripId: string) => `/api/trip-builder/trips/${tripId}/options`,
    optionsEdit: (tripId: string) => `/api/trip-builder/trips/${tripId}/options/edit`,
    optionsGenerate: (tripId: string) =>
      `/api/trip-builder/trips/${tripId}/options/generate`,
    optionsUrl: (tripId: string) => `/api/trip-builder/trips/${tripId}/options/url`,
    chat: (tripId: string) => `/api/trip-builder/trips/${tripId}/chat`,
    chatLines: (tripId: string) => `/api/trip-builder/trips/${tripId}/chat/lines`,
    /** Pre-trip home chat — ephemeral, client lookup tools only. */
    preTripChat: "/api/trip-builder/pre-trip/chat",
    ratesSearch: "/api/trip-builder/rates/search",
    lineItemsPaste: "/api/trip-builder/line-items/paste",
    lineItemsFromRate: "/api/trip-builder/line-items/from-rate",
    lineItemApprove: (lineItemId: string) =>
      `/api/trip-builder/line-items/${lineItemId}/approve`,
    lineItemReject: (lineItemId: string) =>
      `/api/trip-builder/line-items/${lineItemId}/reject`,
    lineItemSelect: (lineItemId: string) =>
      `/api/trip-builder/line-items/${lineItemId}/select`,
    lineItem: (lineItemId: string) => `/api/trip-builder/line-items/${lineItemId}`,
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
