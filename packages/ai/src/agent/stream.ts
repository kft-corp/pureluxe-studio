import { AIMessage, AIMessageChunk } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";

import type { AgentApproval, AgentPhase, AgentStreamChunk, TurnMeter } from "../tools";

import { findAgentTool } from "./tools";

const DEFAULT_PROGRESS = "Gathering details…";

/** One step label per distinct call, in call order ("Finding the client…", "Checking trip history…"). */
export function progressLabels(calls: readonly Pick<ToolCall, "name" | "args">[]): string[] {
  return [
    ...new Set(
      calls.map((call) => {
        const spec = findAgentTool(call.name);
        const parsed = spec?.schema.safeParse(call.args ?? {});
        return spec && parsed?.success ? spec.progress(parsed.data) : DEFAULT_PROGRESS;
      }),
    ),
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toolCallsFromUpdate(update: Record<string, unknown>): ToolCall[] {
  const agent = update.agent;
  if (!isRecord(agent) || !Array.isArray(agent.messages)) return [];
  return agent.messages.flatMap((message) =>
    AIMessage.isInstance(message) ? (message.tool_calls ?? []) : [],
  );
}

function approvalFromUpdate(update: Record<string, unknown>): AgentApproval | null {
  const interrupts = update.__interrupt__;
  if (!Array.isArray(interrupts) || interrupts.length === 0) return null;
  const value = (interrupts[0] as { value?: unknown }).value;
  return isRecord(value) && typeof value.summary === "string" ? (value as AgentApproval) : null;
}

/** Model tokens from the agent node, and the ready-made reply from the reply node. */
function textFromMessagesEvent(event: unknown): string {
  if (!Array.isArray(event)) return "";
  const [message, metadata] = event as [unknown, unknown];
  if (!isRecord(metadata)) return "";
  if (metadata.langgraph_node === "agent") return AIMessageChunk.isInstance(message) ? message.text : "";
  if (metadata.langgraph_node === "reply") return AIMessage.isInstance(message) ? message.text : "";
  return "";
}

/** Chunks the tools send themselves (LangGraph "custom" mode). */
const TOOL_CHUNKS = new Set([
  "changed",
  "choices",
  "opened",
  "rate_compare",
  "leg_split",
  "quote_preview",
]);

function isChunk(value: unknown): value is AgentStreamChunk {
  return isRecord(value) && TOOL_CHUNKS.has(value.kind as string);
}

export type AgentStreamSummary = {
  /** Reply text was streamed. */
  sawText: boolean;
  /** The run paused for an approval. */
  paused: boolean;
};

/**
 * Map a LangGraph stream (modes "messages", "updates", "custom") to chat chunks:
 * tokens → delta, tool calls → looking_up + progress, tool events → changed / choices /
 * opened, an interrupt → approval.
 */
export async function* toAgentChunks(
  stream: AsyncIterable<unknown>,
  meter?: TurnMeter,
): AsyncGenerator<AgentStreamChunk, AgentStreamSummary, unknown> {
  let phase: AgentPhase = "thinking";
  let sawText = false;
  let paused = false;

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

    if (mode === "custom") {
      if (isChunk(payload)) yield payload;
      continue;
    }

    if (mode === "updates" && isRecord(payload)) {
      const approval = approvalFromUpdate(payload);
      if (approval) {
        paused = true;
        yield { kind: "approval", approval };
        continue;
      }
      const calls = toolCallsFromUpdate(payload);
      if (calls.length === 0) continue;
      phase = "looking_up";
      yield { kind: "status", phase };
      for (const label of progressLabels(calls)) yield { kind: "progress", label };
    }
  }

  return { sawText, paused };
}
