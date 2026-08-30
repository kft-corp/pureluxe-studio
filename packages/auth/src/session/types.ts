import type { StudioRole } from "@pureluxe/db";

/** Data stored in the encrypted Studio session cookie. */
export type StudioSessionData = {
  isLoggedIn?: boolean;
  memberId?: string;
  email?: string;
  name?: string;
  role?: StudioRole;
  /** Permission slugs granted to role — loaded at sign-in. */
  permissions?: string[];
  /** Short-lived CSRF token for the Google OAuth round-trip. */
  oauthState?: string;
};
