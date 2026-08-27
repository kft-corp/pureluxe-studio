import { authMessages } from "./auth";
import { commonMessages } from "./common";
import { dbMessages } from "./db";

/** All user-facing messages — import from @pureluxe/shared in UI and API routes. */
export const messages = {
  success: authMessages.success,
  warn: authMessages.warn,
  error: {
    ...authMessages.error,
    ...dbMessages.error,
    ...commonMessages.error,
  },
} as const;

export { authMessages, commonMessages, dbMessages };
