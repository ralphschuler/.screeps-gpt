import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@runtime": resolve(__dirname, "src/runtime"),
      "@shared": resolve(__dirname, "src/shared"),
      "@ai": resolve(__dirname, "src/ai"),
      "@profiler": resolve(__dirname, "src/profiler")
    }
  },
  define: {
    // Enable profiler for tests to match production builds.
    // Note: Must be a string "true" or "false" to match the build configuration
    // which uses JSON.stringify() to create a proper string literal.
    __PROFILER_ENABLED__: JSON.stringify("true"),
    __ROOM_VISUALS_ENABLED__: JSON.stringify("false"),
    __PLAYER_USERNAME__: JSON.stringify("ralphschuler")
  },
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
