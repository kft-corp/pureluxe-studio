import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Agent eval: replays golden conversations against the real model (costs API tokens).
 * Kept out of `pnpm test`: the root config only collects vitest*.config files.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    name: "studio:agent-eval",
    environment: "node",
    include: ["tests/ai/**/*.eval.ts"],
    globalSetup: ["tests/ai/eval/print-report.ts"],
    testTimeout: 180_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
