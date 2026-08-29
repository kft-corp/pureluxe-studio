/**
 * Edge-safe exports for Next.js middleware.
 * Do not import the main @pureluxe/auth entry — it pulls Node-only OAuth code.
 */
export { STUDIO_SESSION_COOKIE_NAME } from "../session/constants";
export { getStudioIronSessionOptionsForEdge } from "../session/edge-session";
export { isStudioSessionActive } from "../session/is-active";
export type { StudioSessionData } from "../session/types";
