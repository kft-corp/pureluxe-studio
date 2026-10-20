import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import type { z } from "zod";

import { errorCodeOf, userMessageOf } from "../../errors";
import type { AgentChoice, AgentStreamChunk, TurnMeter } from "../../tools";
import type { TripFacts } from "../../types";
import { redactSensitive } from "../redact";
import type { AgentToolRisk, ToolCallRef, TripAgentHandlers, TripChange } from "../types";

type ToolSchema = z.ZodObject<z.ZodRawShape>;

/**
 * One agent tool: a thin wrapper around a Studio handler.
 * The description is a contract — what it does, when to use it, when not to, what it returns.
 */
export type AgentToolSpec<Schema extends ToolSchema = ToolSchema> = {
  name: string;
  description: string;
  schema: Schema;
  /** read tools run in parallel; others change the trip, one at a time, and reload it after. */
  risk: AgentToolRisk;
  /** Shown to the advisor while it runs, e.g. "Searching clients…". */
  progress(input: z.infer<Schema>): string;
  run(input: z.infer<Schema>, handlers: TripAgentHandlers, call: ToolCallRef): Promise<unknown>;
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
};

export function defineAgentTool<Schema extends ToolSchema>(
  spec: AgentToolSpec<Schema>,
): AgentToolSpec<Schema> {
  return spec;
}

export type BindAgentToolsContext = {
  handlers: TripAgentHandlers;
  meter?: TurnMeter;
  /** The trip as the agent last loaded it. */
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
 * (a tapped one included) is not made again. A rule or access error goes back to the
 * model as `{ error }` so it can explain; bad inputs are rejected by the schema first.
 */
export function bindAgentTools(
  specs: readonly AgentToolSpec[],
  context: BindAgentToolsContext,
): StructuredToolInterface[] {
  let changes: Promise<unknown> = Promise.resolve();
  const made = new Map<string, TripChange>();

  async function call(
    spec: AgentToolSpec,
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
        emit({ kind: "changed", summary: result.summary, undo: result.undo });
      }
      const choices = spec.choices?.(result, context.trip?.() ?? null) ?? [];
      if (choices.length > 0) emit({ kind: "choices", choices });
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
        if (spec.risk === "read") return call(spec, input, ref, emit);
        const next = changes.then(() => call(spec, input, ref, emit));
        changes = next.catch(() => undefined);
        return next;
      },
      { name: spec.name, description: spec.description, schema: spec.schema },
    ),
  );
}
