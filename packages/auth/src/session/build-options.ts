import type { SessionOptions } from "iron-session";

import { STUDIO_SESSION_COOKIE_NAME } from "./constants";

/** Shared iron-session options — same cookie shape in middleware and route handlers. */
export function buildStudioSessionOptions(
  password: string,
  secure: boolean,
): SessionOptions {
  return {
    password,
    cookieName: STUDIO_SESSION_COOKIE_NAME,
    cookieOptions: {
      secure,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
  };
}
