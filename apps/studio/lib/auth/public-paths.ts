import { apiRoutes, pageRoutes } from "@/lib/routes";

const PUBLIC_PATH_PREFIXES = [pageRoutes.login, apiRoutes.auth.prefix] as const;

/** All authenticated shell routes except login. */
const PROTECTED_PAGE_ROUTES = Object.values(pageRoutes).filter(
  (path) => path !== pageRoutes.login,
);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function requiresAuth(pathname: string): boolean {
  if (isPublicPath(pathname)) {
    return false;
  }

  return PROTECTED_PAGE_ROUTES.some((path) => {
    if (path === pageRoutes.home) {
      return pathname === path;
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export function shouldBypassProxy(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}
