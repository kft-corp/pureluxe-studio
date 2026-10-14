import { AppError } from "@pureluxe/shared";

/** Rate Layer domain error — safe userMessage for Studio APIs. */
export function ratesError(options: {
  userMessage: string;
  code: string;
  status?: number;
  cause?: unknown;
}): AppError {
  return new AppError({
    userMessage: options.userMessage,
    code: options.code,
    status: options.status ?? 400,
    cause: options.cause,
  });
}

/** Capability not available yet (e.g. live supplier API). */
export function ratesNotWiredError(): AppError {
  return ratesError({
    userMessage:
      "Live supplier rates aren't connected yet. Try offline paste or a contracted rate.",
    code: "RATES_NOT_WIRED",
    status: 501,
  });
}
