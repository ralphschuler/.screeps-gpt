/**
 * Regression test for build system
 *
 * This test ensures that the build system works correctly and produces
 * the expected output for deployment to Screeps.
 *
 * Related issue: ralphschuler/.screeps-gpt#158 - Implement modular deployment architecture
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdir, writeFile, unlink, mkdir } from "node:fs/promises";
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

describe.sequential("Build System Regression", () => {
  beforeAll(async () => {
    await acquireLock();
  });

  afterAll(async () => {
    await releaseLock();
  });

  it("should produce single bundle (main.js)", async () => {
    // Clear MODULAR_BUILD env var to use default single bundle mode
    const originalEnv = process.env.MODULAR_BUILD;
    delete process.env.MODULAR_BUILD;

    try {
      await buildProject(false);

      const distDir = resolve("dist");
      const files = await readdir(distDir);
      const jsFiles = files.filter(f => f.endsWith(".js"));

      // Should only have main.js
      expect(jsFiles).toContain("main.js");
      expect(jsFiles.length).toBe(1);
    } finally {
      // Restore env
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      }
    }
  });

  it("should generate sourcemap for main.js", async () => {
    const originalEnv = process.env.MODULAR_BUILD;
    delete process.env.MODULAR_BUILD;

    try {
      await buildProject(false);

      const distDir = resolve("dist");
      const files = await readdir(distDir);

      // Should have main.js.map
      expect(files).toContain("main.js.map");
    } finally {
      // Restore env
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      }
    }
  });
});
