import { refreshClientProfileCompletenessRpc } from "@pureluxe/db";

/**
 * Recompute and persist profile_completeness after related writes.
 * Uses a single DB RPC (signals + update) instead of multiple queries.
 */
export async function refreshClientCompleteness(
  clientId: string,
  actor: { memberId: string },
): Promise<void> {
  await refreshClientProfileCompletenessRpc(clientId, actor.memberId);
}
