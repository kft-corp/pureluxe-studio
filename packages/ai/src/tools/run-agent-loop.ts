import type Anthropic from "@anthropic-ai/sdk";

import { aiProviderFailedError } from "../errors";
import {
  streamClaudeMessage,
  textFromClaudeMessage,
  type ClaudeChatMessage,
} from "../providers";

import { executeTool } from "./execute";
import type { DeskToolHandlers } from "./handlers";
import type { AgentStreamChunk } from "./stream-chunk";
import type { TripToolHandlers } from "./trip";

const DEFAULT_MAX_ROUNDS = 4;

export type RunAgentLoopInput = {
  system: string;
  messages: ClaudeChatMessage[];
  handlers: DeskToolHandlers | TripToolHandlers;
  toolSchemas: Anthropic.Tool[];
  maxRounds?: number;
  apiKey?: string;
  model?: string;
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
  handlers: DeskToolHandlers | TripToolHandlers,
): Promise<void> {
  const toolUses = response.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  messages.push({ role: "assistant", content: response.content });

  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const toolUse of toolUses) {
    const result = await executeTool(toolUse.name, toolUse.input, handlers);
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
  },
): AsyncGenerator<AgentStreamChunk, Anthropic.Message, unknown> {
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
      yield { kind: "status", phase: "writing" };
      firstDelta = false;
    }
    yield { kind: "delta", text: step.value };
    step = await iterator.next();
  }
  return step.value;
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
    });

    if (!wantsTools(response)) {
      if (!textFromClaudeMessage(response)) throw aiProviderFailedError();
      return;
    }

    yield { kind: "status", phase: "looking_up" };
    await runToolCalls(messages, response, input.handlers);
  }

  const fallback = yield* streamModelRound({
    system: `${input.system}${TOOL_LIMIT_NOTE}`,
    messages,
    apiKey: input.apiKey,
    model: input.model,
  });

  if (!textFromClaudeMessage(fallback)) throw aiProviderFailedError();
}
