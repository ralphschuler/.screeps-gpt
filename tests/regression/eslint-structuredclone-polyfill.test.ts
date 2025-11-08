/**
 * Regression test for ESLint structuredClone support (#156)
 *
 * Verifies that ESLint flat config works correctly with Node.js 18+ which has
 * native structuredClone support. The polyfill previously required for Node.js 16
 * has been removed as the repository now requires Node.js 18+.
 *
 * Background: @typescript-eslint v8+ requires structuredClone which was added in Node 17.
 * Since package.json now requires Node.js 18+, we use native structuredClone.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("ESLint structuredClone support (#156)", () => {
  it("should use flat config without polyfill (Node.js 18+ requirement)", () => {
    const configPath = join(process.cwd(), "eslint.config.mjs");
    const configContent = readFileSync(configPath, "utf-8");

    // Verify that the config does NOT load a polyfill (since Node 18+ has native support)
    expect(configContent).not.toContain(".eslintrc-polyfill.cjs");
    expect(configContent).not.toContain("createRequire");

    // Verify it documents Node.js 18+ requirement
    expect(configContent).toContain("Node.js 18+");
  });

  it("should not have old ESLint config files (.eslintrc.cjs)", () => {
    const oldConfigPaths = [".eslintrc.cjs", ".eslintrc-polyfill.cjs"];

    oldConfigPaths.forEach(path => {
      expect(existsSync(join(process.cwd(), path))).toBe(false);
    });
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

  it("should require Node.js 18+ which has native structuredClone", () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8")) as {
      engines: { node: string };
    };

    // Verify Node.js 18+ requirement
    expect(packageJson.engines.node).toContain("18");
  });

  it("native structuredClone should be available", () => {
    // Verify that native structuredClone exists (Node.js 18+ requirement)
    expect(typeof structuredClone).toBe("function");

    // Test basic cloning with native implementation
    const original = { a: 1, b: { c: 2 }, d: [3, 4] };
    const cloned = structuredClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.b).not.toBe(original.b);
    expect(cloned.d).not.toBe(original.d);
  });

  it("should document fix in CHANGELOG", () => {
    const changelog = readFileSync(join(process.cwd(), "CHANGELOG.md"), "utf-8");

    expect(changelog).toContain("structuredClone");
    expect(changelog).toContain("flat config");
    expect(changelog).toContain("#156");
  });
});
