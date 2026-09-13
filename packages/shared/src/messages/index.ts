import { accountMessages } from "./account";
import { authMessages } from "./auth";
import { bookingMessages } from "./bookings";
import { clientMessages } from "./clients";
import { commonMessages } from "./common";
import { dbMessages } from "./db";
import { teamMessages } from "./team";

/** All user-facing messages — import from @pureluxe/shared in UI and API routes. */
export const messages = {
  success: {
    ...authMessages.success,
    ...accountMessages.success,
    ...bookingMessages.success,
    ...clientMessages.success,
    ...teamMessages.success,
  },
  warn: authMessages.warn,
  error: {
    ...authMessages.error,
    ...bookingMessages.error,
    ...clientMessages.error,
    ...dbMessages.error,
    ...commonMessages.error,
    ...teamMessages.error,
  },
} as const;

export {
  accountMessages,
  authMessages,
  bookingMessages,
  clientMessages,
  commonMessages,
  dbMessages,
  teamMessages,
};
