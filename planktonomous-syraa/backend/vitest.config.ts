import { defineConfig } from "vitest/config";

// Unit tests only. Integration tests run via `vitest.integration.config.ts`.
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
    hookTimeout: 10_000,
    reporters: ["default"],
  },
});

