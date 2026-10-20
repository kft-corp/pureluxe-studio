/** The build stage the agent has reached. Raise it as each stage of the redesign lands. */
export const CURRENT_BUILD_STAGE = 2;

export type EvalOptions = {
  /** Steps from later build stages are skipped (and fast-forwarded). */
  stage: number;
  /** main = each step's main wording; all = every variant wording too, one run per variant. */
  variants: "main" | "all";
  /** Each run is repeated this many times: replies vary, so pass rate matters. */
  repeat: number;
  /** Only scenarios whose id contains this text. */
  scenario: string | null;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Options from the environment:
 *   AGENT_EVAL_STAGE=2 · AGENT_EVAL_VARIANTS=all · AGENT_EVAL_REPEAT=3 · AGENT_EVAL_SCENARIO=questions
 */
export function readEvalOptions(env: NodeJS.ProcessEnv = process.env): EvalOptions {
  return {
    stage: positiveInt(env.AGENT_EVAL_STAGE, CURRENT_BUILD_STAGE),
    variants: env.AGENT_EVAL_VARIANTS?.trim().toLowerCase() === "all" ? "all" : "main",
    repeat: positiveInt(env.AGENT_EVAL_REPEAT, 1),
    scenario: env.AGENT_EVAL_SCENARIO?.trim() || null,
  };
}
