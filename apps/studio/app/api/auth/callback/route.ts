import {
  authorizeStudioSignIn,
  getGoogleProfileFromCode,
  setStudioSessionMember,
} from "@pureluxe/auth";
import { AppError } from "@pureluxe/shared";
import { NextResponse } from "next/server";

import { buildLoginUrl, loginErrorToCode } from "@/lib/auth/login-errors";
import { loadStudioSession } from "@/lib/auth/session";
import { pageAuthParams, pageRouteWithSearch, pageRoutes } from "@/lib/routes";

// Google OAuth callback.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const oauthError = searchParams.get("error");

  if (oauthError === "access_denied") {
    return NextResponse.redirect(
      buildLoginUrl(request.url, "sign_in_cancelled").toString(),
    );
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      buildLoginUrl(request.url, "sign_in_failed").toString(),
    );
  }

  const session = await loadStudioSession();

  if (!session.oauthState || session.oauthState !== state) {
    return NextResponse.redirect(
      buildLoginUrl(request.url, "sign_in_failed").toString(),
    );
  }

  try {
    const profile = await getGoogleProfileFromCode(code);
    const member = await authorizeStudioSignIn(profile);
    setStudioSessionMember(session, member);
    await session.save();

    return NextResponse.redirect(
      new URL(
        pageRouteWithSearch(pageRoutes.home, {
          auth: pageAuthParams.signedIn,
        }),
        request.url,
      ),
    );
  } catch (cause) {
    if (cause instanceof AppError) {
      return NextResponse.redirect(
        buildLoginUrl(request.url, loginErrorToCode(cause)).toString(),
      );
    }

    return NextResponse.redirect(
      buildLoginUrl(request.url, "sign_in_failed").toString(),
    );
  }
}
