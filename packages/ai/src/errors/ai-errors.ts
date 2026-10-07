import { AppError, tripMessages } from "@pureluxe/shared";

/** Build an AppError for AI package failures. */
export function aiError(options: {
  userMessage: string;
  code: string;
  status?: number;
  cause?: unknown;
}): AppError {
  return new AppError({
    userMessage: options.userMessage,
    code: options.code,
    status: options.status,
    cause: options.cause,
  });
}

export function aiNotConfiguredError(): AppError {
  return aiError({
    userMessage: tripMessages.error.aiNotConfigured,
    code: "ai.not_configured",
    status: 503,
  });
}

export function aiProviderFailedError(cause?: unknown): AppError {
  return aiError({
    userMessage: tripMessages.error.aiFailed,
    code: "ai.provider_failed",
    status: 503,
    cause,
  });
}
