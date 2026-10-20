/** AppError code or error class name. Never the message text (it can hold client data). */
export function errorCodeOf(cause: unknown): string {
  if (cause && typeof cause === "object" && "code" in cause) {
    const code = (cause as { code: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return cause instanceof Error ? cause.name : "unknown";
}

/** The safe advisor-facing message on an AppError-shaped error. Null otherwise. */
export function userMessageOf(cause: unknown): string | null {
  if (
    cause &&
    typeof cause === "object" &&
    "userMessage" in cause &&
    typeof (cause as { userMessage: unknown }).userMessage === "string"
  ) {
    return (cause as { userMessage: string }).userMessage;
  }
  return null;
}
