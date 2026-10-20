import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { z } from "zod";

import { errorCodeOf, userMessageOf } from "../../errors";
import type { TurnMeter } from "../../tools";
import { redactSensitive } from "../redact";
import type { AgentToolRisk, TripAgentHandlers } from "../types";

type ToolSchema = z.ZodObject<z.ZodRawShape>;

/**
 * One agent tool: a thin wrapper around a Studio handler.
 * The description is a contract — what it does, when to use it, when not to, what it returns.
 */
export type AgentToolSpec<Schema extends ToolSchema = ToolSchema> = {
  name: string;
  description: string;
  schema: Schema;
  risk: AgentToolRisk;
  /** Shown to the advisor while it runs, e.g. "Searching clients…". */
  progress(input: z.infer<Schema>): string;
  run(input: z.infer<Schema>, handlers: TripAgentHandlers): Promise<unknown>;
};

export function defineAgentTool<Schema extends ToolSchema>(
  spec: AgentToolSpec<Schema>,
): AgentToolSpec<Schema> {
  return spec;
}

export type BindAgentToolsContext = {
  handlers: TripAgentHandlers;
  meter?: TurnMeter;
};

const TOOL_FAILED =
  "This lookup failed. Tell the advisor it couldn't be loaded right now and to try again.";

function isToolError(result: unknown): boolean {
  return result !== null && typeof result === "object" && "error" in result;
}

/** JSON for the model. Sensitive fields are removed before the result enters agent memory. */
function toToolContent(result: unknown): string {
  return JSON.stringify(redactSensitive(result ?? null));
}

/**
 * Bind specs to this turn's handlers. Every call is timed for agent_turns.
 * A rule or access error goes back to the model as `{ error }` so it can explain;
 * bad inputs are rejected by the schema before `run`, and the model fixes the call.
 */
export function bindAgentTools(
  specs: readonly AgentToolSpec[],
  context: BindAgentToolsContext,
): StructuredToolInterface[] {
  return specs.map((spec) =>
    tool(
      async (input) => {
        const started = Date.now();
        try {
          const result = await spec.run(input, context.handlers);
          const failed = isToolError(result);
          context.meter?.addToolCall({
            name: spec.name,
            ms: Date.now() - started,
            ok: !failed,
            error_code: failed ? "tool_error" : null,
          });
          return toToolContent(result);
        } catch (cause) {
          const code = errorCodeOf(cause);
          context.meter?.addToolCall({
            name: spec.name,
            ms: Date.now() - started,
            ok: false,
            error_code: code,
          });
          const userMessage = userMessageOf(cause);
          if (!userMessage) console.error(`[agent] tool ${spec.name} failed:`, code);
          return toToolContent({ error: userMessage ?? TOOL_FAILED });
        }
      },
      { name: spec.name, description: spec.description, schema: spec.schema },
    ),
  );
}
