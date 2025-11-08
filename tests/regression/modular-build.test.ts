/**
 * Regression test for modular deployment architecture
 *
 * This test ensures that the modular build system works correctly and
 * maintains backward compatibility with the single-bundle approach.
 *
 * Related issue: ralphschuler/.screeps-gpt#158 - Implement modular deployment architecture
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdir, writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProject } from "../../scripts/lib/buildProject";

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

describe.sequential("Modular Build System Regression", () => {
  beforeAll(async () => {
    await acquireLock();
  });

  afterAll(async () => {
    await releaseLock();
  });
  it("should produce single bundle by default", async () => {
    // Clear MODULAR_BUILD env var
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

  it("should produce multiple modules when MODULAR_BUILD=true", async () => {
    const originalEnv = process.env.MODULAR_BUILD;
    process.env.MODULAR_BUILD = "true";

    try {
      await buildProject(false);

      const distDir = resolve("dist");
      const files = await readdir(distDir);
      const jsFiles = files.filter(f => f.endsWith(".js"));

      // Should have multiple module files
      expect(jsFiles.length).toBeGreaterThan(1);
      expect(jsFiles).toContain("main.js");

      // Should have runtime modules
      expect(jsFiles).toContain("behavior.js");
      expect(jsFiles).toContain("bootstrap.js");
      expect(jsFiles).toContain("evaluation.js");
      expect(jsFiles).toContain("memory.js");
      expect(jsFiles).toContain("metrics.js");
      expect(jsFiles).toContain("respawn.js");
    } finally {
      // Restore env
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      } else {
        delete process.env.MODULAR_BUILD;
      }
    }
  });

  it("should generate sourcemaps for all modules", async () => {
    const originalEnv = process.env.MODULAR_BUILD;
    process.env.MODULAR_BUILD = "true";

    try {
      await buildProject(false);

      const distDir = resolve("dist");
      const files = await readdir(distDir);
      const jsFiles = files.filter(f => f.endsWith(".js"));
      const mapFiles = files.filter(f => f.endsWith(".js.map"));

      // Each .js file should have a corresponding .js.map
      expect(mapFiles.length).toBe(jsFiles.length);

      for (const jsFile of jsFiles) {
        const mapFile = `${jsFile}.map`;
        expect(mapFiles).toContain(mapFile);
      }
    } finally {
      // Restore env
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      } else {
        delete process.env.MODULAR_BUILD;
      }
    }
  });
});
