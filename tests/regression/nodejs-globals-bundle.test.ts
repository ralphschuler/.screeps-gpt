/**
 * Regression test for Node.js globals in Screeps bundle
 *
 * This test ensures that the build process properly handles Node.js-specific
 * globals and prevents them from being included in the Screeps bundle.
 *
 * Related issue: ralphschuler/.screeps-gpt#488 - ReferenceError: process is not defined
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProject } from "../../packages/utilities/scripts/lib/buildProject";

const LOCK_FILE = resolve("dist", ".test-lock");

async function acquireLock(): Promise<void> {
  // Wait for lock to be released with exponential backoff
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    try {
      await mkdir(resolve("dist"), { recursive: true });
      // Try to create lock file exclusively
      await writeFile(LOCK_FILE, String(process.pid), { flag: "wx" });
      // Add a small delay after acquiring to ensure file system is stable
      await new Promise(r => setTimeout(r, 50));
      return;
    } catch {
      // Lock exists, wait and retry
      await new Promise(r => setTimeout(r, Math.min(100 * Math.pow(1.2, attempts), 2000)));
      attempts++;
    }
  }
  throw new Error("Could not acquire build test lock");
}

async function releaseLock(): Promise<void> {
  try {
    await unlink(LOCK_FILE);
  } catch {
    // Lock file might not exist
  }
}

describe.sequential("Node.js Globals Bundle Regression (#488)", () => {
  let bundleContent: string;

  beforeAll(async () => {
    await acquireLock();
    await buildProject(false);

    // Read bundle content once for all tests
    const bundlePath = resolve("dist", "main.js");
    bundleContent = await readFile(bundlePath, "utf-8");
  });

  afterAll(async () => {
    await releaseLock();
  });

  it("should not contain process.env references in bundled code", async () => {
    // Search for process.env references
    const processEnvMatches = bundleContent.match(/process\.env/g);

    expect(processEnvMatches).toBeNull();
  });

  it("should not contain process global object access", async () => {
    // Search for process as an object being accessed (process., process[)
    // This catches actual usage of the process global, not just the word "process"
    // Note: Decorator metadata may contain "process." from import statements (e.g., @process decorator)
    // which is harmless as it's design-time only, not runtime code
    const processMatches = bundleContent.match(/\bprocess[\.\[]/g);

    // Allow up to 3 matches from decorator metadata (one per process file that uses the decorator)
    // Any more than this likely indicates actual process global usage
    const MAX_DECORATOR_PROCESS_REFERENCES = 3;
    expect(processMatches?.length || 0).toBeLessThanOrEqual(MAX_DECORATOR_PROCESS_REFERENCES);
  });

  it("should not contain require() calls", async () => {
    // Search for require() calls (excluding webpack/esbuild runtime code)
    // Look for require as a function call, not as part of __require or similar
    const requireMatches = bundleContent.match(/\brequire\(/g);

    expect(requireMatches).toBeNull();
  });

  it("should not contain __dirname references", async () => {
    // Search for __dirname references
    const dirnameMatches = bundleContent.match(/__dirname/g);

    expect(dirnameMatches).toBeNull();
  });

  it("should not contain __filename references", async () => {
    // Search for __filename references
    const filenameMatches = bundleContent.match(/__filename/g);

    expect(filenameMatches).toBeNull();
  });

  it("should replace TASK_SYSTEM_ENABLED with literal value", async () => {
    // Should not contain the env var reference
    expect(bundleContent).not.toContain("TASK_SYSTEM_ENABLED");
  });

  it("should replace ROOM_VISUALS_ENABLED with literal value", async () => {
    // Should not contain the env var reference
    expect(bundleContent).not.toContain("ROOM_VISUALS_ENABLED");
  });
});
