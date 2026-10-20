import type { BaseMessage } from "@langchain/core/messages";
import { MemorySaver, type BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

/** The node-postgres Pool the saver runs on (Studio owns it; see @pureluxe/db getPgPool). */
export type CheckpointPool = ConstructorParameters<typeof PostgresSaver>[0];

/** Server-only schema created by migration 018. */
export const AGENT_CHECKPOINT_SCHEMA = "agent";

const savers = new WeakMap<CheckpointPool, Promise<PostgresSaver>>();

/**
 * Saved agent progress in Postgres. `setup()` creates or upgrades LangGraph's
 * tables once per process (two quick queries after the first run).
 */
export function getAgentCheckpointer(pool: CheckpointPool): Promise<PostgresSaver> {
  const existing = savers.get(pool);
  if (existing) return existing;

  const ready = (async () => {
    const saver = new PostgresSaver(pool, undefined, { schema: AGENT_CHECKPOINT_SCHEMA });
    await saver.setup();
    return saver;
  })();
  savers.set(pool, ready);
  ready.catch(() => savers.delete(pool));
  return ready;
}

/** One conversation per trip. */
export function tripThreadId(tripId: string): string {
  return `trip:${tripId}`;
}

/** Saved progress held in memory, for evals and tests. Lost when the process ends. */
export function createMemoryCheckpointer(): BaseCheckpointSaver {
  return new MemorySaver();
}

/** What the agent remembers for a trip, as plain lines. Empty when nothing is saved. */
export async function readAgentMemory(
  checkpointer: BaseCheckpointSaver,
  tripId: string,
): Promise<Array<{ role: string; text: string }>> {
  const saved = await checkpointer.getTuple({ configurable: { thread_id: tripThreadId(tripId) } });
  const messages = (saved?.checkpoint.channel_values.messages as BaseMessage[] | undefined) ?? [];
  return messages.map((message) => ({ role: message.getType(), text: message.text }));
}
