import type { SessionOptions } from "iron-session";

import {
  STUDIO_SESSION_COOKIE_NAME,
  STUDIO_SESSION_SECRET_MIN_LENGTH,
} from "./constants";
import { buildStudioSessionOptions } from "./build-options";

function readSessionSecret(): string {
  const password = process.env.STUDIO_SESSION_SECRET;

  if (!password || password.length < STUDIO_SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `${STUDIO_SESSION_COOKIE_NAME}: STUDIO_SESSION_SECRET must be at least ${STUDIO_SESSION_SECRET_MIN_LENGTH} characters`,
    );
  }

  return password;
}

/**
 * iron-session options safe for Next.js Edge middleware.
 * Only reads STUDIO_SESSION_SECRET — no Zod or OAuth env vars.
 */
export function getStudioIronSessionOptionsForEdge(
  isSecure: boolean,
): SessionOptions {
  return buildStudioSessionOptions(readSessionSecret(), isSecure);
}
