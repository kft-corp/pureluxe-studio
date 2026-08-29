import type { StudioRole } from "@pureluxe/db";

/** Data stored in the encrypted Studio session cookie. */
export type StudioSessionData = {
  isLoggedIn?: boolean;
  memberId?: string;
  email?: string;
  name?: string;
  role?: StudioRole;
  /** Short-lived CSRF token for the Google OAuth round-trip. */
  oauthState?: string;
};
