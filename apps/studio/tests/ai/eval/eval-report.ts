import { fileURLToPath } from "node:url";

import type { StepOutcome } from "./run-scenario";

/** The last run's report. Printed after the run and kept for comparing runs (git-ignored). */
export const EVAL_REPORT_PATH = fileURLToPath(new URL("../results/agent-eval-latest.txt", import.meta.url));

export type RunReport = {
  label: string;
  outcomes: StepOutcome[];
};

function cachedPercent(outcomes: StepOutcome[]): number | null {
  let cached = 0;
  let total = 0;
  for (const outcome of outcomes) {
    const metrics = outcome.metrics;
    if (!metrics) continue;
    cached += metrics.cacheReadTokens;
    total += metrics.inputTokens + metrics.cacheReadTokens + metrics.cacheWriteTokens;
  }
  return total > 0 ? Math.round((100 * cached) / total) : null;
}

function average(values: number[]): number | null {
  return values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/** One line per step, then totals: pass rate, cached share, time to first word. */
export function formatEvalReport(reports: RunReport[], stage: number): string {
  const lines: string[] = [`Agent eval · build stage ${stage}`, ""];
  const all = reports.flatMap((report) => report.outcomes);

  for (const report of reports) {
    lines.push(report.label);
    for (const outcome of report.outcomes) {
      const status = outcome.status.toUpperCase().padEnd(4);
      const tools = outcome.tools.length > 0 ? outcome.tools.join(", ") : "-";
      const timing = outcome.metrics?.ttftMs != null ? `${(outcome.metrics.ttftMs / 1000).toFixed(1)}s` : "";
      lines.push(`  ${status}  ${outcome.id.padEnd(28)} ${tools.padEnd(40)} ${timing}`);
      for (const failure of outcome.failures) lines.push(`        ✗ ${failure}`);
    }
    lines.push("");
  }

  const ran = all.filter((outcome) => outcome.status !== "skip");
  const passed = ran.filter((outcome) => outcome.status === "pass").length;
  const cached = cachedPercent(ran);
  const firstWord = average(ran.flatMap((outcome) => (outcome.metrics?.ttftMs != null ? [outcome.metrics.ttftMs] : [])));
  const prep = average(ran.flatMap((outcome) => (outcome.metrics?.prepMs != null ? [outcome.metrics.prepMs] : [])));

  lines.push(
    `Passed ${passed}/${ran.length} steps · skipped ${all.length - ran.length}`,
    `Cached input ${cached == null ? "-" : `${cached}%`} · first word ${firstWord == null ? "-" : `${firstWord} ms`} · preparation ${prep == null ? "-" : `${prep} ms`}`,
  );
  return lines.join("\n");
}
