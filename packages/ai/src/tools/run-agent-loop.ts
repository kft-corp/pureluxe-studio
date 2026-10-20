import type Anthropic from "@anthropic-ai/sdk";

import { aiProviderFailedError, errorCodeOf } from "../errors";
import {
  streamClaudeMessage,
  textFromClaudeMessage,
  type ClaudeChatMessage,
} from "../providers";

import { executeTool } from "./execute";
import type { DeskToolHandlers } from "./handlers";
import type { AgentStreamChunk } from "./stream-chunk";
import { claudeRoundUsage, type TurnMeter } from "./turn-meter";

const DEFAULT_MAX_ROUNDS = 4;

export type RunAgentLoopInput = {
  system: string;
  messages: ClaudeChatMessage[];
  handlers: DeskToolHandlers;
  toolSchemas: Anthropic.Tool[];
  maxRounds?: number;
  apiKey?: string;
  model?: string;
  /** Records tokens, rounds, tool timings, and time to first text. */
  meter?: TurnMeter;
};

function toClaudeMessages(
  messages: ClaudeChatMessage[],
): Anthropic.MessageParam[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function wantsTools(response: Anthropic.Message): boolean {
  if (response.stop_reason !== "tool_use") return false;
  return response.content.some((block) => block.type === "tool_use");
}

async function runToolCalls(
  messages: Anthropic.MessageParam[],
  response: Anthropic.Message,
  handlers: DeskToolHandlers,
  meter?: TurnMeter,
): Promise<void> {
  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  messages.push({ role: "assistant", content: response.content });

  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const toolUse of toolUses) {
    const started = Date.now();
    let result: unknown;
    try {
      result = await executeTool(toolUse.name, toolUse.input, handlers);
    } catch (cause) {
      meter?.addToolCall({
        name: toolUse.name,
        ms: Date.now() - started,
        ok: false,
        error_code: errorCodeOf(cause),
      });
      throw cause;
    }
    const failed =
      result !== null && typeof result === "object" && "error" in result;
    meter?.addToolCall({
      name: toolUse.name,
      ms: Date.now() - started,
      ok: !failed,
      error_code: failed ? "tool_error" : null,
    });
    results.push({
      type: "tool_result",
      tool_use_id: toolUse.id,
      content: JSON.stringify(result),
    });
  }

  messages.push({ role: "user", content: results });
}

/** Stream one Claude turn; emit writing on first text delta; return final message. */
async function* streamModelRound(
  input: {
    system: string;
    messages: Anthropic.MessageParam[];
    tools?: Anthropic.Tool[];
    apiKey?: string;
    model?: string;
    meter?: TurnMeter;
  },
): AsyncGenerator<AgentStreamChunk, Anthropic.Message, unknown> {
  const stopModel = input.meter?.startModelCall();
  try {
    const iterator = streamClaudeMessage({
      system: input.system,
      messages: input.messages,
      tools: input.tools,
      apiKey: input.apiKey,
      model: input.model,
    });

    let firstDelta = true;
    let step = await iterator.next();
    while (!step.done) {
      if (firstDelta) {
        input.meter?.markText();
        yield { kind: "status", phase: "writing" };
        firstDelta = false;
      }
      yield { kind: "delta", text: step.value };
      step = await iterator.next();
    }
    input.meter?.addRound(claudeRoundUsage(step.value));
    return step.value;
  } finally {
    stopModel?.();
  }
}

const TOOL_LIMIT_NOTE =
  "\n\nYou have reached the tool-call limit. Answer from any tool results already in the conversation. Do not call tools.";

/**
 * Streaming loop with Phase 1 status: Thinking → Looking up → Writing.
 */
export async function* streamAgentLoop(
  input: RunAgentLoopInput,
): AsyncGenerator<AgentStreamChunk, void, unknown> {
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const messages = toClaudeMessages(input.messages);

  yield { kind: "status", phase: "thinking" };

  for (let round = 0; round < maxRounds; round += 1) {
    const response = yield* streamModelRound({
      system: input.system,
      messages,
      tools: input.toolSchemas,
      apiKey: input.apiKey,
      model: input.model,
      meter: input.meter,
    });

    if (!wantsTools(response)) {
      if (!textFromClaudeMessage(response)) throw aiProviderFailedError();
      return;
    }

    yield { kind: "status", phase: "looking_up" };
    await runToolCalls(messages, response, input.handlers, input.meter);
  }

  const fallback = yield* streamModelRound({
    system: `${input.system}${TOOL_LIMIT_NOTE}`,
    messages,
    apiKey: input.apiKey,
    model: input.model,
    meter: input.meter,
  });

  if (!textFromClaudeMessage(fallback)) throw aiProviderFailedError();
}
