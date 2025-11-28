/**
 * Regression test for __PROFILER_ENABLED__ string type in build configuration
 *
 * Issue Context:
 * The profiler data export failed because esbuild's `define` option was not
 * creating proper string literals. The value `"true"` was interpreted as the
 * boolean keyword `true`, not the string literal `"true"`.
 *
 * This caused string comparisons like `__PROFILER_ENABLED__ === "true"` to fail,
 * which disabled event subscriptions and caused the retention policy to always
 * return early.
 *
 * Root Cause:
 * ```typescript
 * // buildProject.ts - WRONG
 * __PROFILER_ENABLED__: validateProfilerEnabled() ? "true" : "false",
 * // esbuild interprets "true" as the boolean true, not string "true"
 *
 * // buildProject.ts - CORRECT
 * __PROFILER_ENABLED__: JSON.stringify(validateProfilerEnabled() ? "true" : "false"),
 * // JSON.stringify creates proper string literal: "\"true\""
 * ```
 *
 * Solution:
 * 1. Wrapped the value in `JSON.stringify()` in buildProject.ts
 * 2. Updated all comparisons to use string comparison (`=== "true"`)
 * 3. Updated type declarations from `boolean` to `"true" | "false"`
 *
 * Related Issue: #1499 - fix(monitoring): profiler data export returns undefined
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("__PROFILER_ENABLED__ string type configuration", () => {
  const buildConfigPath = resolve("packages/utilities/scripts/lib/buildProject.ts");
  const mainTsPath = resolve("packages/bot/src/main.ts");
  const profilerPath = resolve("packages/screeps-profiler/src/Profiler.ts");
  const botTypesPath = resolve("packages/bot/types.d.ts");

  describe("Build configuration", () => {
    it("should use JSON.stringify for __PROFILER_ENABLED__", () => {
      const content = readFileSync(buildConfigPath, "utf-8");

      // The define should use JSON.stringify to create a proper string literal
      expect(content).toMatch(/__PROFILER_ENABLED__:\s*JSON\.stringify\(/);
    });

    it("should have __PROFILER_ENABLED__ in RUNTIME_DEFINES", () => {
      const content = readFileSync(buildConfigPath, "utf-8");

      // Verify the define exists and follows the pattern
      expect(content).toContain("__PROFILER_ENABLED__");
      expect(content).toMatch(/RUNTIME_DEFINES\s*=\s*\{[^}]*__PROFILER_ENABLED__/s);
    });
  });

  describe("Type declarations", () => {
    it("should declare __PROFILER_ENABLED__ as string union in bot types", () => {
      const content = readFileSync(botTypesPath, "utf-8");

      // Type should be "true" | "false", not boolean
      expect(content).toMatch(/__PROFILER_ENABLED__:\s*["']true["']\s*\|\s*["']false["']/);
    });

    it("should declare __PROFILER_ENABLED__ as string union in profiler", () => {
      const content = readFileSync(profilerPath, "utf-8");

      // Type should be "true" | "false", not boolean
      expect(content).toMatch(/declare\s+const\s+__PROFILER_ENABLED__:\s*["']true["']\s*\|\s*["']false["']/);
    });
  });

  describe("Runtime comparisons", () => {
    it("should use string comparison in main.ts ensureProfilerRunning", () => {
      const content = readFileSync(mainTsPath, "utf-8");

      // Extract the ensureProfilerRunning function
      const functionMatch = content.match(/function\s+ensureProfilerRunning\(\):\s*void\s*\{([\s\S]*?)\n\}/);
      expect(functionMatch).not.toBeNull();

      const functionBody = functionMatch![1];

      // Should use string comparison, not boolean check
      expect(functionBody).toMatch(/__PROFILER_ENABLED__\s*!==\s*["']true["']/);
      // Should NOT use falsy check (which would fail for string "false")
      expect(functionBody).not.toMatch(/!\s*__PROFILER_ENABLED__(?!\s*!==)/);
    });

    it("should use string comparison in main.ts applyProfilerRetentionPolicy", () => {
      const content = readFileSync(mainTsPath, "utf-8");

      // Extract the applyProfilerRetentionPolicy function
      const functionMatch = content.match(/function\s+applyProfilerRetentionPolicy\(\):\s*void\s*\{([\s\S]*?)\n\}/);
      expect(functionMatch).not.toBeNull();

      const functionBody = functionMatch![1];

      // Should use string comparison
      expect(functionBody).toMatch(/__PROFILER_ENABLED__\s*!==\s*["']true["']/);
    });

    it("should use string comparison in main.ts event subscription block", () => {
      const content = readFileSync(mainTsPath, "utf-8");

      // Check the event subscription conditional block
      expect(content).toMatch(/if\s*\(\s*__PROFILER_ENABLED__\s*===\s*["']true["']\s*\)/);
    });

    it("should use string comparison in profiler decorator", () => {
      const content = readFileSync(profilerPath, "utf-8");

      // The profile decorator should check against "true" string
      expect(content).toMatch(/__PROFILER_ENABLED__\s*!==\s*["']true["']/);
      // Should NOT use falsy check
      expect(content).not.toMatch(/!\s*__PROFILER_ENABLED__(?!\s*!==)/);
    });
  });

  describe("Built output verification", () => {
    const distPath = resolve("dist/main.js");

    it("should have dist/main.js generated", () => {
      expect(existsSync(distPath)).toBe(true);
    });

    it("should have correct profiler conditionals in built output", () => {
      if (!existsSync(distPath)) {
        return; // Skip if dist doesn't exist (hasn't been built)
      }

      const content = readFileSync(distPath, "utf-8");

      // When profiler is enabled (default), the condition `"true" !== "true"` should become `false`
      // Look for ensureProfilerRunning function with `if (false)` at the start
      const ensureProfilerMatch = content.match(
        /function\s+ensureProfilerRunning\(\)\s*\{[\s\S]*?if\s*\(false\)\s*\{\s*return;\s*\}/
      );

      // If profiler is enabled, this condition should be `if (false)` not `if (true)`
      // This means the early return is NOT taken, so profiler code runs
      expect(ensureProfilerMatch).not.toBeNull();
    });

    it("should have event subscriptions enabled in built output when profiler is enabled", () => {
      if (!existsSync(distPath)) {
        return; // Skip if dist doesn't exist
      }

      const content = readFileSync(distPath, "utf-8");

      // When profiler is enabled, the condition `"true" === "true"` should become `true`
      // Look for the eventLogger block being inside `if (true)`
      const eventLoggerMatch = content.match(/if\s*\(true\)\s*\{[\s\S]*?eventLogger/);

      expect(eventLoggerMatch).not.toBeNull();
    });
  });
});
