/**
 * Regression test for Node.js globals in Screeps bundle
 *
 * This test ensures that the build process properly handles Node.js-specific
 * globals and prevents them from being included in the Screeps bundle.
 *
 * Related issue: ralphschuler/.screeps-gpt#488 - ReferenceError: process is not defined
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProject } from "../../scripts/buildProject";

describe("Node.js Globals Bundle Regression (#488)", () => {
  beforeAll(async () => {
    // Ensure dist directory exists and build
    await mkdir(resolve("dist"), { recursive: true });
    await buildProject(false);
  });

  it("should not contain process.env references in bundled code", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Search for process.env references
    const processEnvMatches = bundleContent.match(/process\.env/g);

    expect(processEnvMatches).toBeNull();
  });

  it("should not contain process global object access", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Search for process as an object being accessed (process., process[)
    // This catches actual usage of the process global, not just the word "process"
    const processMatches = bundleContent.match(/\bprocess[\.\[]/g);

    expect(processMatches).toBeNull();
  });

  it("should not contain require() calls", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Search for require() calls (excluding webpack/esbuild runtime code)
    // Look for require as a function call, not as part of __require or similar
    const requireMatches = bundleContent.match(/\brequire\(/g);

    expect(requireMatches).toBeNull();
  });

  it("should not contain __dirname references", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Search for __dirname references
    const dirnameMatches = bundleContent.match(/__dirname/g);

    expect(dirnameMatches).toBeNull();
  });

  it("should not contain __filename references", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Search for __filename references
    const filenameMatches = bundleContent.match(/__filename/g);

    expect(filenameMatches).toBeNull();
  });

  it("should replace TASK_SYSTEM_ENABLED with literal value", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Should not contain the env var reference
    expect(bundleContent).not.toContain("TASK_SYSTEM_ENABLED");
  });

  it("should replace ROOM_VISUALS_ENABLED with literal value", async () => {
    const bundlePath = resolve("dist", "main.js");
    const bundleContent = await readFile(bundlePath, "utf-8");

    // Should not contain the env var reference
    expect(bundleContent).not.toContain("ROOM_VISUALS_ENABLED");
  });
});
