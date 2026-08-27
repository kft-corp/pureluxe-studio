import { AppError, messages } from "@pureluxe/shared";

/** Supabase query failed — safe message for UI. */
export function dbQueryError(cause: unknown): AppError {
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
