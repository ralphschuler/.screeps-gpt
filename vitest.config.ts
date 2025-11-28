import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

// Node.js 16 compatibility: Polyfill crypto.getRandomValues
// This must be set up before Vite initializes to avoid startup errors
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      getRandomValues: (array: Uint8Array | Uint16Array | Uint32Array) => {
        const buffer = randomBytes(array.byteLength);
        array.set(new Uint8Array(buffer));
        return array;
      }
    },
    writable: true,
    configurable: true
  });
}

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@runtime": resolve(rootDir, "packages/bot/src/runtime"),
      "@shared": resolve(rootDir, "packages/bot/src/shared"),
      "@ai": resolve(rootDir, "packages/bot/src/ai"),
      "@ralphschuler/screeps-profiler": resolve(rootDir, "packages/screeps-profiler/src")
    }
  },
  define: {
    // Enable profiler for tests to match production builds.
    // Note: Must be a string "true" or "false" to match the build configuration
    // which uses JSON.stringify() to create a proper string literal.
    __PROFILER_ENABLED__: JSON.stringify("true"),
    __ROOM_VISUALS_ENABLED__: JSON.stringify("false"),
    __TASK_SYSTEM_ENABLED__: false,
    __PLAYER_USERNAME__: JSON.stringify("ralphschuler")
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: [resolve(rootDir, "tests/setup.ts")],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/tests/**",
        "**/scripts/**",
        "**/*.test.ts",
        "**/*.spec.ts",
        "**/vitest.config.ts"
      ]
    }
  }
});
