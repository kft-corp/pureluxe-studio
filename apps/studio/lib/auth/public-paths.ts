import { apiRoutes, pageRoutes } from "@/lib/routes";

// No login needed.
export const PUBLIC_PATH_PREFIXES = [
  pageRoutes.login,
  apiRoutes.auth.prefix,
] as const;

// Add new protected pages here.
const PROTECTED_EXACT_PATHS = [pageRoutes.home] as const;

const PROTECTED_PATH_PREFIXES = [
  "/trip-builder",
  "/bookings",
  "/clients",
  "/trips",
  "/team",
  "/settings",
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Known protected pages only (not 404s).
export function requiresAuth(pathname: string): boolean {
  if (isPublicPath(pathname)) {
    return false;
  }

  if (
    PROTECTED_EXACT_PATHS.includes(
      pathname as (typeof PROTECTED_EXACT_PATHS)[number],
    )
  ) {
    return true;
  }

  return PROTECTED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Skip auth for static files and Next internals.
export function shouldBypassProxy(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}
