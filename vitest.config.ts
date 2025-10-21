import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@runtime": resolve(rootDir, "src/runtime"),
      "@shared": resolve(rootDir, "src/shared"),
      "@ai": resolve(rootDir, "src/ai")
    }
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: [resolve(rootDir, "tests/setup.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"]
    }
  }
});
