import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "ai:unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
