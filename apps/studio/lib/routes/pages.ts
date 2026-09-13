// Page URLs for links and router.push.
export const pageRoutes = {
  home: "/",
  login: "/login",
  tripBuilder: "/trip-builder",
  /** Open Trip Builder with this client pre-selected (when Trip Builder ships). */
  tripBuilderWithClient: (clientId: string) =>
    pageRouteWithSearch("/trip-builder", { primary_client_id: clientId }),
  bookings: "/bookings",
  booking: (bookingId: string) => `/bookings/${bookingId}`,
  bookingNew: "/bookings/new",
  clients: "/clients",
  clientNew: "/clients/new",
  client: (clientId: string) => `/clients/${clientId}`,
  trips: "/trips",
  trainer: "/trainer",
  tasks: "/tasks",
  commissions: "/commissions",
  payments: "/payments",
  account: "/account",
  team: "/team",
  settings: "/settings",
} as const;

// Path with query string, e.g. "/?auth=signed_in".
export function pageRouteWithSearch(
  path: string,
  params: Record<string, string>,
): string {
  const search = new URLSearchParams(params).toString();
  return search ? `${path}?${search}` : path;
}

// ?auth= values on the home page.
export const pageAuthParams = {
  signedIn: "signed_in",
} as const;
