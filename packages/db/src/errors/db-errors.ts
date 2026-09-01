import { AppError, messages } from "@pureluxe/shared";

import { isPgrst303Error } from "../client/pgrst303";

/** Supabase query failed — safe message for UI. */
export function dbQueryError(cause: unknown): AppError {
  if (isPgrst303Error(cause) && process.env.NODE_ENV === "development") {
    console.error(
      "[db] PGRST303 JWT issued at future — sync your system clock (Windows: Settings → Time & language → Sync now) or use the legacy service_role JWT key from Supabase dashboard.",
      cause,
    );
  }

  return new AppError({
    userMessage: messages.error.dbUnavailable,
    code: "db.query_failed",
    status: 503,
    cause,
  });
}

/** Supabase env missing or invalid on the server. */
export function dbConfigError(cause?: unknown): AppError {
  return new AppError({
    userMessage: messages.error.dbSetupIncomplete,
    code: "db.config_invalid",
    status: 503,
    cause,
  });
}
