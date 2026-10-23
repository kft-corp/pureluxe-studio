/**
 * Golden conversations against the real model (redesign §10).
 * Run: pnpm eval:agent — see eval-options.ts for AGENT_EVAL_* settings.
 * Tools read the scenario seed (no database); agent memory is in-process.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { AGENT_SCENARIOS } from "../scenarios";

import { EVAL_REPORT_PATH, formatEvalReport, type RunReport } from "./eval-report";
import { readEvalOptions } from "./eval-options";
import { planScenario, playStep, skipStep, startEvalRun, type EvalRun } from "./run-scenario";

const options = readEvalOptions();
const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
const reports: RunReport[] = [];

const selected = AGENT_SCENARIOS.filter(
  ({ scenario }) => !options.scenario || scenario.id.includes(options.scenario),
);

function variantCount(steps: ReturnType<typeof planScenario>): number {
  if (options.variants === "main") return 1;
  return 1 + Math.max(0, ...steps.map((step) => (step.advisor.kind === "say" ? step.advisor.variants?.length ?? 0 : 0)));
}

describe.skipIf(!hasApiKey)(`agent eval (build stage ${options.stageLabel})`, () => {
  for (const { scenario, seed } of selected) {
    const plan = planScenario(scenario, options.stage);
    if (plan.every((step) => step.skip)) continue;

    for (let variant = 0; variant < variantCount(plan); variant += 1) {
      for (let attempt = 0; attempt < options.repeat; attempt += 1) {
        const label = [
          scenario.id,
          variant > 0 ? `variant ${variant}` : null,
          options.repeat > 1 ? `run ${attempt + 1}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        describe(label, () => {
          const report: RunReport = { label, outcomes: [] };
          reports.push(report);
          let run: EvalRun | null = null;

          for (const step of plan) {
            it(step.skip ? `${step.id} — skipped: ${step.skip}` : step.id, async (context) => {
              run ??= startEvalRun(scenario, seed, { variant, runId: `${variant}-${attempt}` });
              if (step.skip) {
                report.outcomes.push(skipStep(run, step));
                context.skip();
                return;
              }
              const outcome = await playStep(run, step);
              report.outcomes.push(outcome);
              expect(outcome.failures, `Sent: ${outcome.sent}\n\nReply:\n${outcome.reply}`).toEqual([]);
            });
          }
        });
      }
    }
  }

  afterAll(() => {
    mkdirSync(dirname(EVAL_REPORT_PATH), { recursive: true });
    writeFileSync(EVAL_REPORT_PATH, `${formatEvalReport(reports, options.stageLabel)}\n`);
  });
});

describe.runIf(!hasApiKey)("agent eval", () => {
  it.skip("needs ANTHROPIC_API_KEY in .env.local", () => {});
});
