import { ChatAnthropic } from "@langchain/anthropic";
import type { AIMessage, BaseMessage } from "@langchain/core/messages";
import type { Runnable, RunnableConfig } from "@langchain/core/runnables";
import type { StructuredToolInterface } from "@langchain/core/tools";

import { aiNotConfiguredError } from "../errors";
import type { ModelRoundUsage } from "../tools";

const DEFAULT_MODEL = "claude-sonnet-5-5";
const MAX_OUTPUT_TOKENS = 1024;
/** SDK-level retries per model before the backup model is tried. */
const MAX_RETRIES = 2;

/** Provider statuses where another model may succeed: timeouts, rate limits, overload, outages. */
const OUTAGE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

export type AgentModelOptions = {
  /** Defaults to ANTHROPIC_API_KEY. */
  apiKey?: string;
  /** Defaults to ANTHROPIC_MODEL, then Claude Sonnet. */
  model?: string;
  /** Defaults to ANTHROPIC_FALLBACK_MODEL. Null turns the backup off. */
  fallbackModel?: string | null;
};

type BoundModel = Runnable<BaseMessage[], AIMessage>;

/** The model pair for one turn, with tools bound. */
export type AgentModels = {
  primaryName: string;
  /** Tools available. */
  withTools: { primary: BoundModel; fallback: BoundModel | null };
  /** Tools listed but not callable — the lookup limit is reached. */
  answerOnly: { primary: BoundModel; fallback: BoundModel | null };
};

function createChatModel(model: string, apiKey: string): ChatAnthropic {
  return new ChatAnthropic({
    model,
    apiKey,
    maxTokens: MAX_OUTPUT_TOKENS,
    maxRetries: MAX_RETRIES,
    streaming: true,
    streamUsage: true,
  });
}

/**
 * Bind the tools to the main and backup models.
 * The top-level cache breakpoint advances with the chat, so earlier rounds are read from cache.
 */
export function createAgentModels(
  tools: StructuredToolInterface[],
  options: AgentModelOptions = {},
): AgentModels {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw aiNotConfiguredError();

  const primaryName = options.model ?? process.env.ANTHROPIC_MODEL?.trim() ?? DEFAULT_MODEL;
  const fallbackName =
    options.fallbackModel === undefined
      ? process.env.ANTHROPIC_FALLBACK_MODEL?.trim() || null
      : options.fallbackModel;

  const primary = createChatModel(primaryName, apiKey);
  const fallback =
    fallbackName && fallbackName !== primaryName ? createChatModel(fallbackName, apiKey) : null;
  const cache = { cache_control: { type: "ephemeral" as const } };

  return {
    primaryName,
    withTools: {
      primary: primary.bindTools(tools, cache),
      fallback: fallback?.bindTools(tools, cache) ?? null,
    },
    answerOnly: {
      primary: primary.bindTools(tools, { ...cache, tool_choice: "none" }),
      fallback: fallback?.bindTools(tools, { ...cache, tool_choice: "none" }) ?? null,
    },
  };
}

function statusOf(cause: unknown): number | null {
  if (cause && typeof cause === "object" && "status" in cause) {
    const status = (cause as { status: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

/** True for outages and rate limits (worth trying the backup), false for bad requests. */
export function isProviderOutage(cause: unknown): boolean {
  const status = statusOf(cause);
  return status == null || OUTAGE_STATUSES.has(status);
}

/** Call the main model; on an outage, the backup model answers instead. */
export async function invokeWithFallback(
  pair: { primary: BoundModel; fallback: BoundModel | null },
  messages: BaseMessage[],
  config: RunnableConfig,
): Promise<{ message: AIMessage; fallback: boolean }> {
  try {
    return { message: await pair.primary.invoke(messages, config), fallback: false };
  } catch (cause) {
    if (!pair.fallback || !isProviderOutage(cause)) throw cause;
    return { message: await pair.fallback.invoke(messages, config), fallback: true };
  }
}

function modelNameOf(message: AIMessage): string | null {
  const fromMeta = message.response_metadata?.model ?? message.response_metadata?.model_name;
  const fromKwargs = message.additional_kwargs?.model;
  const name = typeof fromMeta === "string" ? fromMeta : fromKwargs;
  return typeof name === "string" && name ? name : null;
}

/**
 * Normalised usage for the turn meter. LangChain counts cached tokens inside
 * input_tokens; the meter stores uncached input separately, like the v1 baseline.
 */
export function roundUsageOf(message: AIMessage, fallback: boolean): ModelRoundUsage {
  const usage = message.usage_metadata;
  const cacheRead = usage?.input_token_details?.cache_read ?? 0;
  const cacheWrite = usage?.input_token_details?.cache_creation ?? 0;
  return {
    model: modelNameOf(message),
    inputTokens: Math.max(0, (usage?.input_tokens ?? 0) - cacheRead - cacheWrite),
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    fallback,
  };
}
