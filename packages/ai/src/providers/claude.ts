import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "@pureluxe/shared";

import { aiNotConfiguredError, aiProviderFailedError } from "../errors";

const DEFAULT_MODEL = "claude-sonnet-5-5";
const DEFAULT_MAX_TOKENS = 1024;

export type ClaudeChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type CompleteClaudeTextInput = {
  system: string;
  /** Single-turn convenience — ignored when `messages` is set. */
  user?: string;
  /** Multi-turn history (must end with the latest user turn). */
  messages?: ClaudeChatMessage[];
  /** Defaults to ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Defaults to ANTHROPIC_MODEL or Claude Sonnet. */
  model?: string;
  maxTokens?: number;
};

export type CreateClaudeMessageInput = {
  system: string;
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  apiKey?: string;
  model?: string;
  maxTokens?: number;
};

function resolveApiKey(apiKey?: string): string {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw aiNotConfiguredError();
  return key;
}

function resolveModel(model?: string): string {
  return model ?? process.env.ANTHROPIC_MODEL?.trim() ?? DEFAULT_MODEL;
}

function toAnthropicMessages(
  input: CompleteClaudeTextInput,
): Anthropic.MessageParam[] {
  if (input.messages?.length) {
    return input.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  const user = input.user?.trim();
  if (!user) {
    throw aiProviderFailedError(new Error("Claude call missing user message."));
  }

  return [{ role: "user", content: user }];
}

/** Join text blocks from a Claude message. */
export function textFromClaudeMessage(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/**
 * One Claude messages.create call (supports tools).
 * Used by the non-streaming agentic tool loop.
 */
export async function createClaudeMessage(
  input: CreateClaudeMessageInput,
): Promise<Anthropic.Message> {
  try {
    const client = new Anthropic({ apiKey: resolveApiKey(input.apiKey) });
    return await client.messages.create({
      model: resolveModel(input.model),
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: input.messages,
      ...(input.tools?.length ? { tools: input.tools } : {}),
    });
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw aiProviderFailedError(cause);
  }
}

/**
 * Stream one Claude turn (supports tools).
 * Yields text deltas as they arrive; returns the final Message (for tool_use).
 */
export async function* streamClaudeMessage(
  input: CreateClaudeMessageInput,
): AsyncGenerator<string, Anthropic.Message, unknown> {
  try {
    const client = new Anthropic({ apiKey: resolveApiKey(input.apiKey) });
    const stream = client.messages.stream({
      model: resolveModel(input.model),
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: input.messages,
      ...(input.tools?.length ? { tools: input.tools } : {}),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta" &&
        event.delta.text
      ) {
        yield event.delta.text;
      }
    }

    return await stream.finalMessage();
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw aiProviderFailedError(cause);
  }
}

/**
 * One non-streaming Claude text completion (no tools).
 */
export async function completeClaudeText(
  input: CompleteClaudeTextInput,
): Promise<string> {
  try {
    const response = await createClaudeMessage({
      system: input.system,
      messages: toAnthropicMessages(input),
      apiKey: input.apiKey,
      model: input.model,
      maxTokens: input.maxTokens,
    });

    const text = textFromClaudeMessage(response);
    if (!text) throw aiProviderFailedError();
    return text;
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw aiProviderFailedError(cause);
  }
}

/**
 * Stream Claude text deltas (no tools).
 * Yields only text pieces — caller concatenates / persists.
 */
export async function* streamClaudeText(
  input: CompleteClaudeTextInput,
): AsyncGenerator<string, void, unknown> {
  const final = yield* streamClaudeMessage({
    system: input.system,
    messages: toAnthropicMessages(input),
    apiKey: input.apiKey,
    model: input.model,
    maxTokens: input.maxTokens,
  });

  if (!textFromClaudeMessage(final)) {
    throw aiProviderFailedError();
  }
}
