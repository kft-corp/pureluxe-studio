import type { ChatHistoryMessage } from "@pureluxe/ai";
import { listTripChatMessagesPage, type TripChatMessage } from "@pureluxe/db";

/**
 * Earlier studio chat for the model. A button tap reads as a tap, never as
 * words the advisor typed. Unfinished replies and empty rows are left out.
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
        !(row.role === "assistant" && row.incomplete) &&
        row.content.trim().length > 0,
    )
    .map((row) => ({
      role: row.role,
      content: row.kind === "action" ? `[Tapped] ${row.content}` : row.content,
    }));
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
