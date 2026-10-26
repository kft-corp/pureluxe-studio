/**
 * Soft deadline for one agent turn on Vercel Hobby (maxDuration = 60s).
 * Abort slightly early so abandon + lock release can finish before the hard kill.
 */
export const TURN_MAX_DURATION_SECONDS = 60;
/** Abort the agent this many ms before the platform hard timeout. */
export const TURN_BUDGET_MS = 48_000;

export type TurnBudget = {
  /** True after the soft timer fires (not a client cancel). */
  hit: boolean;
  /** Clear the timer; safe to call more than once. */
  clear: () => void;
};

/**
 * Abort `controller` after TURN_BUDGET_MS so we can save progress and free the
 * trip lock before Vercel kills the function at 60s.
 */
export function armTurnBudget(
  controller: AbortController,
  log?: { scope: string; details?: Record<string, unknown> },
): TurnBudget {
  const state = { hit: false };
  const timer = setTimeout(() => {
    if (controller.signal.aborted) return;
    state.hit = true;
    console.info(`[trip-chat] ${log?.scope ?? "turn"} budget abort`, {
      budgetMs: TURN_BUDGET_MS,
      maxDurationSeconds: TURN_MAX_DURATION_SECONDS,
      ...log?.details,
    });
    controller.abort();
  }, TURN_BUDGET_MS);
  timer.unref?.();

  return {
    get hit() {
      return state.hit;
    },
    clear() {
      clearTimeout(timer);
    },
  };
}

/** True when the thrown value (or signal) is an abort, including our soft budget. */
export function isAbortCause(cause: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (!cause || typeof cause !== "object") return false;
  if (cause instanceof Error && (cause.name === "AbortError" || cause.name === "TimeoutError")) {
    return true;
  }
  return "name" in cause && (cause as { name?: string }).name === "AbortError";
}
