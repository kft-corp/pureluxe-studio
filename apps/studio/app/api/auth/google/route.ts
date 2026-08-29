import { randomUUID } from "node:crypto";

import { buildGoogleAuthUrl } from "@pureluxe/auth";
import { NextResponse } from "next/server";

import { buildLoginUrl } from "@/lib/auth/login-errors";
import { loadStudioSession } from "@/lib/auth/session";

// Google sign-in redirect.
export async function GET(request: Request) {
  try {
    const session = await loadStudioSession();
    const state = randomUUID();
    session.oauthState = state;
    await session.save();

    const url = buildGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.redirect(
      buildLoginUrl(request.url, "sign_in_failed").toString(),
    );
  }
}
