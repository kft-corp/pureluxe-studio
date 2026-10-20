import type Anthropic from "@anthropic-ai/sdk";

/** One tool call inside a reply. Names and timings only — never inputs or results. */
export type AgentToolCallMetric = {
  name: string;
  ms: number;
  ok: boolean;
  error_code: string | null;
};

/** Token usage for one model call, the same shape for every provider client. */
export type ModelRoundUsage = {
  model: string | null;
  /** Input tokens not served from or written to the prompt cache. */
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** True when the backup model answered this round. */
  fallback?: boolean;
};

/** Totals for one agent reply, summed across model rounds. */
export type AgentTurnMetrics = {
  /** Model id from the last round. Null when no round finished. */
  model: string | null;
  rounds: number;
  toolCalls: AgentToolCallMetric[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** True when the backup model answered any round. */
  fallbackUsed: boolean;
  /** Request start → first streamed text. Null when no text was streamed. */
  ttftMs: number | null;
  /** Request start → first model call (access checks, saving, memory, trip load). Null when no call started. */
  prepMs: number | null;
  /** Time spent inside model calls, summed across rounds. */
  modelMs: number;
  /** Request start → each named preparation step, e.g. { access: 180, trip: 1300 }. */
  prepSteps: Record<string, number>;
  /** Request start → now. */
  totalMs: number;
};

/**
 * Collects metrics while an agent reply streams. Create it when the request
 * starts so timings include checking access and loading the trip.
 */
export type TurnMeter = {
  markText(): void;
  /** Record when a preparation step finished. The first mark of a name wins. */
  mark(step: string): void;
  /** Call as a model request starts; call the returned function when it ends. */
  startModelCall(): () => void;
  addRound(usage: ModelRoundUsage): void;
  addToolCall(metric: AgentToolCallMetric): void;
  read(): AgentTurnMetrics;
};

/** Usage from an Anthropic SDK message. `input_tokens` there already excludes the cache. */
export function claudeRoundUsage(message: Anthropic.Message): ModelRoundUsage {
  return {
    model: message.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
  };
}

export function createTurnMeter(now: () => number = Date.now): TurnMeter {
  const startedAt = now();
  let firstTextAt: number | null = null;
  let model: string | null = null;
  let rounds = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheWriteTokens = 0;
  let fallbackUsed = false;
  let firstModelAt: number | null = null;
  let modelMs = 0;
  const prepSteps: Record<string, number> = {};
  const toolCalls: AgentToolCallMetric[] = [];

  return {
    markText() {
      if (firstTextAt == null) firstTextAt = now();
    },
    mark(step) {
      prepSteps[step] ??= now() - startedAt;
    },
    startModelCall() {
      const started = now();
      firstModelAt ??= started;
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        modelMs += now() - started;
      };
    },
    addRound(usage) {
      rounds += 1;
      model = usage.model ?? model;
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      cacheReadTokens += usage.cacheReadTokens;
      cacheWriteTokens += usage.cacheWriteTokens;
      fallbackUsed ||= usage.fallback === true;
    },
    addToolCall(metric) {
      toolCalls.push(metric);
    },
    read() {
      return {
        model,
        rounds,
        toolCalls: [...toolCalls],
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheWriteTokens,
        fallbackUsed,
        ttftMs: firstTextAt == null ? null : firstTextAt - startedAt,
        prepMs: firstModelAt == null ? null : firstModelAt - startedAt,
        modelMs,
        prepSteps: { ...prepSteps },
        totalMs: now() - startedAt,
      };
    },
  };
}
