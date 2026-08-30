import {
  getStudioIronSessionOptionsForEdge,
  isStudioSessionActive,
  type StudioSessionData,
} from "@pureluxe/auth/edge";
import { getIronSession } from "iron-session";
import { type NextRequest, NextResponse } from "next/server";

import { isPublicPath, requiresAuth, shouldBypassProxy } from "@/lib/auth/public-paths";
import { pageRoutes } from "@/lib/routes";

/** Edge auth gate — login required for protected routes. RBAC is enforced in Server Components. */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBypassProxy(pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const isSecure = request.nextUrl.protocol === "https:";

  try {
    const session = await getIronSession<StudioSessionData>(
      request,
      response,
      getStudioIronSessionOptionsForEdge(isSecure),
    );

    const loggedIn = isStudioSessionActive(session);

    if (pathname === pageRoutes.login && loggedIn) {
      return NextResponse.redirect(new URL(pageRoutes.home, request.url));
    }

    if (!requiresAuth(pathname)) {
      return response;
    }

    if (!loggedIn) {
      const loginUrl = new URL(pageRoutes.login, request.url);
      loginUrl.searchParams.set("error", "session_expired");
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch {
    if (isPublicPath(pathname) || !requiresAuth(pathname)) {
      return response;
    }

    return NextResponse.redirect(new URL(pageRoutes.login, request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
