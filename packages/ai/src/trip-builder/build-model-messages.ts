import type { ClaudeChatMessage } from "../providers/claude";
import type { ChatHistoryMessage } from "../types";

const MAX_HISTORY = 20;

/**
 * Build model chat messages from prior history + the latest advisor message.
 * Merges adjacent same-role turns so Anthropic's alternating roles rule holds.
 */
export function buildModelMessages(
  history: ChatHistoryMessage[] | undefined,
  latestUserMessage: string,
): ClaudeChatMessage[] {
  const prior = (history ?? [])
    .filter((message) => message.content.trim().length > 0)
    .slice(-MAX_HISTORY);

  const merged: ClaudeChatMessage[] = [];
  for (const message of prior) {
    const content = message.content.trim();
    const last = merged[merged.length - 1];
    if (last && last.role === message.role) {
      last.content = `${last.content}\n\n${content}`;
    } else {
      merged.push({ role: message.role, content });
    }
  }

  const user = latestUserMessage.trim();
  const last = merged[merged.length - 1];
  if (last?.role === "user") {
    last.content = `${last.content}\n\n${user}`;
  } else {
    merged.push({ role: "user", content: user });
  }

  while (merged.length > 0 && merged[0].role !== "user") {
    merged.shift();
  }

  return merged;
}
