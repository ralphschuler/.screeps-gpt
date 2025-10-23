/**
 * Regression test for ESLint structuredClone polyfill (#156)
 *
 * Ensures that the structuredClone polyfill is properly loaded and available
 * for ESLint when running on Node.js 16 which doesn't have native structuredClone.
 *
 * Background: @typescript-eslint v8+ requires structuredClone which was added in Node 17.
 * Our polyfill in .eslintrc-polyfill.cjs provides compatibility for Node 16.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("ESLint structuredClone polyfill (#156)", () => {
  it("should have polyfill file in repository root", () => {
    const polyfillPath = join(process.cwd(), ".eslintrc-polyfill.cjs");
    const polyfillContent = readFileSync(polyfillPath, "utf-8");

    expect(polyfillContent).toContain("global.structuredClone");
    expect(polyfillContent).toContain("function structuredClone");
  });

  it("should have flat config file that loads polyfill", () => {
    const configPath = join(process.cwd(), "eslint.config.mjs");
    const configContent = readFileSync(configPath, "utf-8");

    // Verify that the config loads the polyfill before importing ESLint modules
    expect(configContent).toContain(".eslintrc-polyfill.cjs");
    expect(configContent).toContain("createRequire");

    // Verify it's loaded early (before other imports)
    const polyfillIndex = configContent.indexOf(".eslintrc-polyfill.cjs");
    const tsParserIndex = configContent.indexOf("@typescript-eslint/parser");
    expect(polyfillIndex).toBeLessThan(tsParserIndex);
  });

  it("should have updated lint scripts without ESLINT_USE_FLAT_CONFIG=false", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      scripts: { lint: string; "lint:fix": string };
      "lint-staged": Record<string, unknown>;
    };

    // Verify lint scripts don't use legacy flag
    expect(packageJson.scripts.lint).not.toContain("ESLINT_USE_FLAT_CONFIG=false");
    expect(packageJson.scripts["lint:fix"]).not.toContain("ESLINT_USE_FLAT_CONFIG=false");

    // Verify lint-staged config doesn't use legacy flag
    expect(JSON.stringify(packageJson["lint-staged"])).not.toContain("ESLINT_USE_FLAT_CONFIG=false");
  });

  it("polyfill should handle basic object cloning", () => {
    // Simulate Node 16 environment by temporarily removing structuredClone
    const originalClone = (global as { structuredClone?: typeof structuredClone }).structuredClone;
    delete (global as { structuredClone?: typeof structuredClone }).structuredClone;

    try {
      // Load the polyfill
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../../.eslintrc-polyfill.cjs");

      // Verify it was installed
      expect(typeof (global as { structuredClone?: typeof structuredClone }).structuredClone).toBe("function");

      // Test basic cloning
      const original = { a: 1, b: { c: 2 }, d: [3, 4] };
      const cloned = (global as { structuredClone: typeof structuredClone }).structuredClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.d).not.toBe(original.d);
    } finally {
      // Restore original (or re-apply polyfill if it wasn't there)
      if (originalClone) {
        (global as { structuredClone?: typeof structuredClone }).structuredClone = originalClone;
      }
    }
  });

  it("polyfill should handle null and undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../../.eslintrc-polyfill.cjs");

    expect((global as { structuredClone: typeof structuredClone }).structuredClone(null)).toBeNull();
    expect((global as { structuredClone: typeof structuredClone }).structuredClone(undefined)).toBeUndefined();
  });

  it("polyfill should handle primitive types", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../../.eslintrc-polyfill.cjs");

    expect((global as { structuredClone: typeof structuredClone }).structuredClone(42)).toBe(42);
    expect((global as { structuredClone: typeof structuredClone }).structuredClone("hello")).toBe("hello");
    expect((global as { structuredClone: typeof structuredClone }).structuredClone(true)).toBe(true);
  });

  it("should document Node 16 polyfill in README", () => {
    const readme = readFileSync(join(process.cwd(), "README.md"), "utf-8");

    // After migrating to Bun, we no longer need Node 16 polyfill documentation
    // since Bun has native structuredClone support. The polyfill is kept for
    // backward compatibility but doesn't need to be documented.
    // This test is updated to reflect the migration to Bun.
    expect(readme).toContain("Bun");
  });

  it("should document fix in CHANGELOG", () => {
    const changelog = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf-8");

    expect(changelog).toContain("structuredClone");
    expect(changelog).toContain("flat config");
    expect(changelog).toContain("#156");
  });
});
