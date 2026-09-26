import { ZodError } from "zod";

import { messages } from "../messages";

/** Error with a message safe to show users in UI or API responses. */
export class AppError extends Error {
  readonly userMessage: string;
  readonly code: string;
  readonly status: number;

  constructor(options: {
    userMessage: string;
    code: string;
    status?: number;
    cause?: unknown;
  }) {
    super(options.userMessage, { cause: options.cause });
    this.name = "AppError";
    this.userMessage = options.userMessage;
    this.code = options.code;
    this.status = options.status ?? 500;
  }
}

/** Turn any thrown value into an AppError with friendly copy. */
export function toAppError(
  cause: unknown,
  fallback = messages.error.somethingWentWrong,
): AppError {
  if (cause instanceof AppError) return cause;

  if (cause instanceof ZodError) {
    const first = cause.issues[0];
    return new AppError({
      userMessage: first?.message ?? fallback,
      code: "VALIDATION_ERROR",
      status: 400,
      cause,
    });
  }

  return new AppError({
    userMessage: fallback,
    code: "unknown",
    cause,
  });
}
