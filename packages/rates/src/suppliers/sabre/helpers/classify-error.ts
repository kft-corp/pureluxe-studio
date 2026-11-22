import { SabreHttpError } from "../client";

export type SabreErrorKind =
  | "auth"
  | "timeout"
  | "http_4xx"
  | "http_5xx"
  | "bad_request"
  | "unknown";

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Classify thrown Sabre client/API errors for logging + message mapping. */
export function classifySabreError(err: unknown): SabreErrorKind {
  const message = messageOf(err);

  if (isAbortError(err) || /timed out/i.test(message)) {
    return "timeout";
  }

  if (/Sabre auth failed/i.test(message) || /not configured/i.test(message)) {
    return "auth";
  }

  if (err instanceof SabreHttpError) {
    if (err.status === 401 || err.status === 403) return "auth";
    if (err.status >= 500) return "http_5xx";
    if (err.status >= 400) return "http_4xx";
  }

  if (/hotel code is required/i.test(message)) {
    return "bad_request";
  }

  return "unknown";
}
