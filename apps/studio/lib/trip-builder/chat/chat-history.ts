import type { ChatHistoryMessage } from "@pureluxe/ai";
import { listTripChatMessagesPage, type TripChatMessage } from "@pureluxe/db";

/**
 * Earlier studio chat for the model. A button tap reads as a tap, never as
 * words the advisor typed. Empty rows are left out. Interrupted assistant
 * replies stay in with a clear prefix so the model does not invent excuses.
 */
export function toChatHistory(
  rows: readonly TripChatMessage[],
  excludeId: string | null,
): ChatHistoryMessage[] {
  return rows
    .filter(
      (row) =>
        row.id !== excludeId &&
        row.kind !== "event" &&
        row.content.trim().length > 0,
    )
    .map((row) => {
      if (row.role === "assistant" && row.incomplete) {
        return {
          role: row.role,
          content: `[Interrupted reply — do not claim you already answered] ${row.content}`,
        };
      }
      return {
        role: row.role,
        content: row.kind === "action" ? `[Tapped] ${row.content}` : row.content,
      };
    });
}

/** The latest `limit` studio rows as model history. */
export async function loadChatHistory(
  tripId: string,
  options: { limit: number; excludeId: string | null },
): Promise<ChatHistoryMessage[]> {
  const { messages } = await listTripChatMessagesPage(tripId, "studio", {
    limit: options.limit,
  });
  return toChatHistory(messages, options.excludeId);
}
