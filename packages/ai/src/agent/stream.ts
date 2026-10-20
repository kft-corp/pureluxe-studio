import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";

import type { AgentPhase, AgentStreamChunk, TurnMeter } from "../tools";

import { findAgentTool } from "./tools";

const DEFAULT_PROGRESS = "Looking up…";

/** "Searching clients…" for one call; "Searching clients · Checking hotel…" for several. */
export function progressLabel(calls: readonly Pick<ToolCall, "name" | "args">[]): string {
  const labels = [
    ...new Set(
      calls.map((call) => {
        const spec = findAgentTool(call.name);
        const parsed = spec?.schema.safeParse(call.args ?? {});
        return spec && parsed?.success ? spec.progress(parsed.data) : DEFAULT_PROGRESS;
      }),
    ),
  ];
  if (labels.length <= 1) return labels[0] ?? DEFAULT_PROGRESS;
  return `${labels.map((label) => label.replace(/…$/, "")).join(" · ")}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toolCallsFromUpdate(update: unknown): ToolCall[] {
  if (!isRecord(update) || !isRecord(update.agent)) return [];
  const messages = update.agent.messages;
  if (!Array.isArray(messages)) return [];
  return messages.flatMap((message) =>
    AIMessage.isInstance(message) ? (message.tool_calls ?? []) : [],
  );
}

function textFromMessagesEvent(event: unknown): string {
  if (!Array.isArray(event)) return "";
  const [message, metadata] = event as [unknown, unknown];
  if (!isRecord(metadata) || metadata.langgraph_node !== "agent") return "";
  return AIMessageChunk.isInstance(message) ? message.text : "";
}

export type AgentStreamSummary = {
  /** Reply text was streamed. False means the model answered with nothing. */
  sawText: boolean;
};

/**
 * Map a LangGraph stream (modes "messages" + "updates") to chat chunks:
 * model tokens → delta, tool calls → looking_up + a progress label.
 */
export async function* toAgentChunks(
  stream: AsyncIterable<unknown>,
  meter?: TurnMeter,
): AsyncGenerator<AgentStreamChunk, AgentStreamSummary, unknown> {
  let phase: AgentPhase = "thinking";
  let sawText = false;

  for await (const event of stream) {
    if (!Array.isArray(event) || event.length !== 2) continue;
    const [mode, payload] = event as [unknown, unknown];

    if (mode === "messages") {
      const text = textFromMessagesEvent(payload);
      if (!text) continue;
      if (!sawText) meter?.markText();
      sawText = true;
      if (phase !== "writing") {
        phase = "writing";
        yield { kind: "status", phase };
      }
      yield { kind: "delta", text };
      continue;
    }

    if (mode === "updates") {
      const calls = toolCallsFromUpdate(payload);
      if (calls.length === 0) continue;
      phase = "looking_up";
      yield { kind: "status", phase };
      yield { kind: "progress", label: progressLabel(calls) };
    }
  }

  return { sawText };
}
