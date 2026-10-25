import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "rates:unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
});
