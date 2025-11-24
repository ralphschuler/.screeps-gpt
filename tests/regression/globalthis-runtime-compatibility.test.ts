/**
 * Regression test for globalThis runtime compatibility
 *
 * This test ensures that the build process properly replaces ES2020 globalThis
 * references with ES5-compatible global references for Screeps runtime compatibility.
 *
 * Related issue: ralphschuler/.screeps-gpt#1314 - ReferenceError: globalThis is not defined
 * Related issues: ralphschuler/.screeps-gpt#488, ralphschuler/.screeps-gpt#513, ralphschuler/.screeps-gpt#978
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

describe.sequential("globalThis Runtime Compatibility (#1314)", () => {
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

  it("should not contain globalThis references in bundled code", async () => {
    // Search for globalThis references (ES2020 feature not supported in Screeps)
    const globalThisMatches = bundleContent.match(/globalThis/g);

    // The bundle should not contain any globalThis references
    // All should be replaced with 'global' via esbuild define mapping
    expect(globalThisMatches).toBeNull();
  });

  it("should contain global references for runtime globals", async () => {
    // Verify that global is used instead of globalThis
    // This is Screeps-compatible (ES5 global object)
    const globalMatches = bundleContent.match(/\bglobal\b/g);

    // Should have at least some global references (from our code and dependencies)
    expect(globalMatches).not.toBeNull();
    expect(globalMatches!.length).toBeGreaterThan(0);
  });

  it("should replace globalThis from dependencies (e.g., zod)", async () => {
    // The original issue was at line 12250 in zod's global registry code
    // Verify that zod's globalThis usage has been replaced with global
    const zodRegistryPattern = /global\.__zod_globalRegistry/;

    // Should contain the replaced pattern
    expect(bundleContent).toMatch(zodRegistryPattern);
  });
});
