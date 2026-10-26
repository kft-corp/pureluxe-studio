import { errorCodeOf } from "@pureluxe/ai";
import { beginAgentRun, endAgentRun } from "@pureluxe/db";

/**
 * A crashed / hard-killed run frees the trip after this long.
 * Kept under ~Hobby turn budget so a Vercel 60s kill does not leave "busy" for 2 minutes.
 */
const LOCK_TTL_SECONDS = 75;
/** Renewed well inside the TTL while the agent is still working. */
const RENEW_EVERY_MS = 25_000;

export type TripRunLock = {
  runId: string;
  /** Stop renewing and free the trip. Safe to call more than once; never throws. */
  release: () => Promise<void>;
};

/**
 * One agent run per trip at a time. Null when another run holds the trip:
 * the advisor gets a busy reply and their message is sent when that run ends.
 */
export async function holdTripRunLock(tripId: string): Promise<TripRunLock | null> {
  const runId = crypto.randomUUID();
  const taken = await beginAgentRun({ tripId, runId, ttlSeconds: LOCK_TTL_SECONDS });
  if (!taken) return null;

  const renew = setInterval(() => {
    beginAgentRun({ tripId, runId, ttlSeconds: LOCK_TTL_SECONDS }).catch((cause: unknown) => {
      console.error("[agent] run lock renew failed:", errorCodeOf(cause));
    });
  }, RENEW_EVERY_MS);
  renew.unref?.();

  let released = false;
  return {
    runId,
    async release() {
      if (released) return;
      released = true;
      clearInterval(renew);
      try {
        await endAgentRun({ tripId, runId });
        console.info("[trip-chat] trip run lock released", { tripId, runId });
      } catch (cause) {
        console.error("[agent] run lock release failed:", errorCodeOf(cause));
      }
    },
  };
}
