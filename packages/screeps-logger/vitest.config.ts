import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "../..");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: [resolve(rootDir, "tests/setup.ts")],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/vitest.config.ts"
      ]
    }
  }
});
