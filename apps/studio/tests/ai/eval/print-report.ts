import { existsSync, readFileSync, rmSync } from "node:fs";

import { EVAL_REPORT_PATH } from "./eval-report";

/**
 * Vitest global setup: clears the last report, then prints the new one once the
 * run ends. Runs in the main process, so the report shows even when every step passes.
 */
export default function setup() {
  rmSync(EVAL_REPORT_PATH, { force: true });
  return () => {
    if (!existsSync(EVAL_REPORT_PATH)) return;
    process.stdout.write(`\n${readFileSync(EVAL_REPORT_PATH, "utf8")}\n`);
  };
}
