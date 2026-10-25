import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { z } from "zod";

import { errorCodeOf, userMessageOf } from "../../errors";
import type { AgentChoice, AgentStreamChunk, TurnMeter } from "../../tools";
import type { TripFacts } from "../../types";
import { redactSensitive } from "../redact";
import type {
  AgentToolRisk,
  DeskAgentHandlers,
  HomeAgentHandlers,
  ToolCallRef,
  TripAgentHandlers,
  TripChange,
} from "../types";

export type ToolSchema = z.ZodObject<z.ZodRawShape>;

/**
 * One agent tool: a thin wrapper around a Studio handler.
 * The description is a contract — what it does, when to use it, when not to, what it returns.
 * `Handlers` is the set of Studio callbacks the tool needs.
 */
export type AgentToolSpec<Schema extends ToolSchema = ToolSchema, Handlers = TripAgentHandlers> = {
  name: string;
  description: string;
  schema: Schema;
  /** read tools run in parallel; others change the trip, one at a time, and reload it after. */
  risk: AgentToolRisk;
  /** Shown to the advisor while it runs, e.g. "Finding the client…". Plain, professional, and never names internals. */
  progress(input: z.infer<Schema>): string;
  run(input: z.infer<Schema>, handlers: Handlers, call: ToolCallRef): Promise<unknown>;
  /**
   * When the agent chose this from typed text: the approval card's text, or null to run
   * straight away. A labelled button tap is already the approval and skips this.
   */
  confirm?(input: z.infer<Schema>, trip: TripFacts | null): string | null;
  /** After a tap, reply with the change summary instead of calling the model. */
  quickReply?: true;
  /** The same input twice in one message means two changes (Undo). Other changes run once. */
  repeatable?: true;
  /** Buttons to show under the reply for this result. */
  choices?(result: unknown, trip: TripFacts | null): AgentChoice[];
  /** Multi-hotel compare card to show under the reply (rates_search). Null when suppressed (e.g. client already chose). */
  rateCompare?(result: unknown, trip: TripFacts | null): import("../../tools").RateCompareCard | null;
  /** Multi-city split card to show under the reply (trip_propose_split). */
  legSplit?(result: unknown): import("../../tools").LegSplitCard | null;
  /** The trip this result opens for the advisor (home chat). */
  opens?(result: unknown): { tripId: string; created: boolean } | null;
  /** Open the options quote PDF (short-lived signed URL). */
  quotePreview?(result: unknown): { url: string } | null;
};

function toolDefiner<Handlers>() {
  return <Schema extends ToolSchema>(spec: AgentToolSpec<Schema, Handlers>) => spec;
}

/** Trip chat tools: they read or change the open trip. */
export const defineAgentTool = toolDefiner<TripAgentHandlers>();
/** Lookups both chats share. */
export const defineDeskTool = toolDefiner<DeskAgentHandlers>();
/** Home chat tools: create or open a trip. */
export const defineHomeTool = toolDefiner<HomeAgentHandlers>();

export type BindAgentToolsContext<Handlers> = {
  handlers: Handlers;
  meter?: TurnMeter;
  /** The trip as the agent last loaded it. Null in the home chat. */
  trip?: () => TripFacts | null;
};

const TOOL_FAILED =
  "This lookup failed. Tell the advisor it couldn't be loaded right now and to try again.";

function isToolError(result: unknown): boolean {
  return result !== null && typeof result === "object" && "error" in result;
}

function isChange(result: unknown): result is TripChange {
  return result !== null && typeof result === "object" && (result as TripChange).ok === true;
}

/** JSON for the model. Sensitive fields are removed before the result enters agent memory. */
function toToolContent(result: unknown): string {
  return JSON.stringify(redactSensitive(result ?? null));
}

/** Sends a chunk to the chat stream (LangGraph "custom" mode). A no-op outside a graph run. */
type Emit = (chunk: AgentStreamChunk) => void;

function writerOf(config: LangGraphRunnableConfig | undefined): Emit {
  return config?.writer ?? (() => {});
}

/**
 * Bind specs to this turn's handlers. Every call is timed for agent_turns.
 * Changes run one at a time in call order, and a change already made in this message
 * (a tapped one included) is not made again. A lookup repeated with the same input
 * reuses the first result until something changes. A rule or access error goes back
 * to the model as `{ error }` so it can explain; bad inputs are rejected by the schema first.
 */
export function bindAgentTools<Handlers>(
  specs: readonly AgentToolSpec<ToolSchema, Handlers>[],
  context: BindAgentToolsContext<Handlers>,
): StructuredToolInterface[] {
  let changes: Promise<unknown> = Promise.resolve();
  const made = new Map<string, TripChange>();
  const lookups = new Map<string, Promise<string>>();

  async function call(
    spec: AgentToolSpec<ToolSchema, Handlers>,
    input: Record<string, unknown>,
    ref: ToolCallRef,
    emit: Emit,
  ): Promise<string> {
    const started = Date.now();
    const key = spec.risk !== "read" && !spec.repeatable ? `${spec.name}:${JSON.stringify(input)}` : null;
    const earlier = key ? made.get(key) : undefined;
    if (earlier) {
      context.meter?.addToolCall({ name: spec.name, ms: 0, ok: true, error_code: "repeated" });
      return toToolContent({ ...earlier, unchanged: true, note: "Already done in this message. Don't repeat it." });
    }
    try {
      const result = await spec.run(input, context.handlers, ref);
      const failed = isToolError(result);
      context.meter?.addToolCall({
        name: spec.name,
        ms: Date.now() - started,
        ok: !failed,
        error_code: failed ? "tool_error" : null,
      });
      if (spec.risk !== "read" && isChange(result) && !result.unchanged) {
        if (key) made.set(key, result);
        lookups.clear();
        emit({ kind: "changed", summary: result.summary, undo: result.undo === true });
      }
      const choices = spec.choices?.(result, context.trip?.() ?? null) ?? [];
      if (choices.length > 0) emit({ kind: "choices", choices });
      const compare = spec.rateCompare?.(result, context.trip?.() ?? null) ?? null;
      if (compare) emit({ kind: "rate_compare", compare });
      const split = spec.legSplit?.(result) ?? null;
      if (split) emit({ kind: "leg_split", split });
      const opened = spec.opens?.(result);
      if (opened) emit({ kind: "opened", ...opened });
      const preview = spec.quotePreview?.(result);
      if (preview) emit({ kind: "quote_preview", url: preview.url });
      return toToolContent(result);
    } catch (cause) {
      const code = errorCodeOf(cause);
      context.meter?.addToolCall({ name: spec.name, ms: Date.now() - started, ok: false, error_code: code });
      const userMessage = userMessageOf(cause);
      if (!userMessage) console.error(`[agent] tool ${spec.name} failed:`, code);
      return toToolContent({ error: userMessage ?? TOOL_FAILED });
    }
  }

  return specs.map((spec) =>
    tool(
      (input, config) => {
        const ref = { id: config?.toolCall?.id ?? crypto.randomUUID() };
        const emit = writerOf(config as LangGraphRunnableConfig);
        if (spec.risk === "read") {
          const key = `${spec.name}:${JSON.stringify(input)}`;
          const earlier = lookups.get(key);
          if (earlier) {
            context.meter?.addToolCall({ name: spec.name, ms: 0, ok: true, error_code: "reused" });
            return earlier;
          }
          const next = call(spec, input, ref, emit);
          lookups.set(key, next);
          return next;
        }
        const next = changes.then(() => call(spec, input, ref, emit));
        changes = next.catch(() => undefined);
        return next;
      },
      { name: spec.name, description: spec.description, schema: spec.schema },
    ),
  );
}
