import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@agentstackhq/adapters": new URL("./packages/adapters/src/index.ts", import.meta.url).pathname,
      "@agentstackhq/cli": new URL("./packages/cli/src/index.ts", import.meta.url).pathname,
      "@agentstackhq/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@agentstackhq/telemetry": new URL("./packages/telemetry/src/index.ts", import.meta.url).pathname
    }
  },
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    restoreMocks: true
  }
});
