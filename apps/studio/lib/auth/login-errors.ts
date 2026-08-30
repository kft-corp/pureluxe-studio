import { AppError } from "@pureluxe/shared";

import { pageRoutes } from "@/lib/routes";

// /login?error= values.
export type LoginErrorCode =
  | "access_denied"
  | "inactive"
  | "sign_in_failed"
  | "sign_in_cancelled"
  | "session_expired"
  | "db_unavailable";

export function loginErrorToCode(error: AppError): LoginErrorCode {
  switch (error.code) {
    case "auth.access_denied":
      return "access_denied";
    case "auth.account_inactive":
      return "inactive";
    case "db.query_failed":
    case "db.config_invalid":
      return "db_unavailable";
    default:
      return "sign_in_failed";
  }
}

export function buildLoginUrl(origin: string, error?: LoginErrorCode): URL {
  const url = new URL(pageRoutes.login, origin);
  if (error) {
    url.searchParams.set("error", error);
  }
  return url;
}
