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
