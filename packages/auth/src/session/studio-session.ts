import type { StudioRole } from "@pureluxe/db";
import { getIronSession } from "iron-session";

import { buildStudioSessionOptions } from "./build-options";
import { isStudioSessionActive } from "./is-active";
import type { StudioSessionData } from "./types";
import { getStudioAuthEnv } from "../validation";

export type { StudioSessionData } from "./types";
export { isStudioSessionActive } from "./is-active";

/** iron-session options for Studio route handlers (Node runtime). */
export function getStudioIronSessionOptions() {
  const { STUDIO_SESSION_SECRET } = getStudioAuthEnv();

  return buildStudioSessionOptions(
    STUDIO_SESSION_SECRET,
    process.env.NODE_ENV === "production",
  );
}

type NextCookieStore = {
  get: (name: string) => { name: string; value: string } | undefined;
  set: {
    (name: string, value: string, cookie?: object): void;
    (options: object): void;
  };
};

/** Load the Studio session from request cookies (App Router route handlers). */
export async function getStudioSession(cookieStore: unknown) {
  return getIronSession<StudioSessionData>(
    cookieStore as NextCookieStore,
    getStudioIronSessionOptions(),
  );
}

/** Write member details into the session after a successful sign-in. */
export function setStudioSessionMember(
  session: StudioSessionData,
  member: { id: string; email: string; name: string; role: StudioRole },
): void {
  session.isLoggedIn = true;
  session.memberId = member.id;
  session.email = member.email;
  session.name = member.name;
  session.role = member.role;
  delete session.oauthState;
}

/** Clear all session fields (logout). */
export function clearStudioSession(session: StudioSessionData): void {
  session.isLoggedIn = false;
  delete session.memberId;
  delete session.email;
  delete session.name;
  delete session.role;
  delete session.oauthState;
}
