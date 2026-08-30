const path = require("node:path");

const { loadEnvConfig } = require("@next/env");

/** Load monorepo root .env* before Next starts (repo root, not apps/studio). */
loadEnvConfig(path.resolve(__dirname, "../../.."), undefined, undefined, true);
