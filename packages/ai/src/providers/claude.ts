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

function resolveApiKey(apiKey?: string): string {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw aiNotConfiguredError();
  return key;
}

function toAnthropicMessages(input: CompleteClaudeTextInput): Anthropic.MessageParam[] {
  if (input.messages?.length) {
    return input.messages.map((message) => ({ role: message.role, content: message.content }));
  }

  const user = input.user?.trim();
  if (!user) {
    throw aiProviderFailedError(new Error("Claude call missing user message."));
  }
  return [{ role: "user", content: user }];
}

/**
 * One non-streaming Claude text completion (no tools), for small helpers such as
 * the options-PDF wording edits. The chats use the LangGraph agent instead.
 */
export async function completeClaudeText(input: CompleteClaudeTextInput): Promise<string> {
  try {
    const client = new Anthropic({ apiKey: resolveApiKey(input.apiKey) });
    const response = await client.messages.create({
      model: input.model ?? process.env.ANTHROPIC_MODEL?.trim() ?? DEFAULT_MODEL,
      max_tokens: input.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: input.system,
      messages: toAnthropicMessages(input),
    });
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    if (!text) throw aiProviderFailedError();
    return text;
  } catch (cause) {
    if (cause instanceof AppError) throw cause;
    throw aiProviderFailedError(cause);
  }
}
