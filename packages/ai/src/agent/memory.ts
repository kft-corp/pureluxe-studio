import {
  AIMessage,
  HumanMessage,
  RemoveMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";

import type { ChatHistoryMessage } from "../types";

import { redactText } from "./redact";

/** Start index of each advisor turn. A turn = advisor message + everything until the next one. */
function turnStarts(messages: readonly BaseMessage[]): number[] {
  const starts: number[] = [];
  messages.forEach((message, index) => {
    if (HumanMessage.isInstance(message)) starts.push(index);
  });
  return starts;
}

/**
 * The last `maxTurns` advisor turns, whole. Cutting at an advisor message keeps
 * every tool call next to its result, which the model API requires.
 */
export function recentTurns(messages: readonly BaseMessage[], maxTurns: number): BaseMessage[] {
  const starts = turnStarts(messages);
  if (starts.length === 0) return [...messages];
  const from = starts[Math.max(0, starts.length - maxTurns)]!;
  return messages.slice(from);
}

/**
 * Drop tool calls that never got a result (a run that crashed between the model and
 * the tools). The model API rejects a tool call without its result.
 */
export function repairToolPairs(messages: readonly BaseMessage[]): BaseMessage[] {
  const answered = new Set(
    messages.flatMap((message) =>
      ToolMessage.isInstance(message) ? [message.tool_call_id] : [],
    ),
  );
  return messages.flatMap((message) => {
    if (!AIMessage.isInstance(message) || !message.tool_calls?.length) return [message];
    if (message.tool_calls.every((call) => call.id && answered.has(call.id))) return [message];
    const text = message.text.trim();
    return text ? [new AIMessage({ content: text, id: message.id })] : [];
  });
}

/**
 * Remove the oldest whole turns from saved memory once it holds more than `maxStored`
 * messages. The advisor's chat stays in trip_chat_messages; this only bounds agent state.
 */
export function pruneOldTurns(
  messages: readonly BaseMessage[],
  maxStored: number,
): RemoveMessage[] {
  if (messages.length <= maxStored) return [];
  const keepFrom = turnStarts(messages).find((start) => messages.length - start <= maxStored);
  if (keepFrom == null || keepFrom === 0) return [];
  return messages
    .slice(0, keepFrom)
    .flatMap((message) => (message.id ? [new RemoveMessage({ id: message.id })] : []));
}

/**
 * Earlier chat as agent messages, for a thread with no saved memory yet (trips
 * started before the new agent). Starts with the advisor and ends with a reply,
 * so the new advisor message follows naturally.
 */
export function seedMessages(
  history: readonly ChatHistoryMessage[],
  maxMessages: number,
): BaseMessage[] {
  const merged: ChatHistoryMessage[] = [];
  for (const row of history) {
    const content = row.content.trim();
    if (!content) continue;
    const last = merged[merged.length - 1];
    if (last?.role === row.role) last.content = `${last.content}\n\n${content}`;
    else merged.push({ role: row.role, content });
  }

  const window = merged.slice(-maxMessages);
  while (window[0]?.role === "assistant") window.shift();
  while (window[window.length - 1]?.role === "user") window.pop();

  // Own ids: graph nodes add these, and id-less node output shares one id per run.
  return window.map((row) => {
    const fields = { content: redactText(row.content), id: crypto.randomUUID() };
    return row.role === "user" ? new HumanMessage(fields) : new AIMessage(fields);
  });
}
