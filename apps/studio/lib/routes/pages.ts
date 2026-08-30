// Page URLs for links and router.push.
export const pageRoutes = {
  home: "/",
  login: "/login",
  tripBuilder: "/trip-builder",
  bookings: "/bookings",
  clients: "/clients",
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
