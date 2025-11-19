/**
 * Unit tests for build validation enhancements
 *
 * Tests the enhanced validation in buildProject.ts that checks:
 * - File existence
 * - Non-zero file size
 * - Minimum size thresholds
 * - Expected exports (loop function in main.js)
 *
 * Related issue: ralphschuler/.screeps-gpt - Enhance build validation to check file size and content validity
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProject, validateFile } from "../../packages/utilities/scripts/lib/buildProject";

const TEST_DIST_DIR = resolve("dist");
const TEST_TEMP_DIR = resolve("/tmp/build-validation-test");
const LOCK_FILE = resolve(TEST_DIST_DIR, ".test-lock");

async function acquireLock(): Promise<void> {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    try {
      await mkdir(TEST_DIST_DIR, { recursive: true });
      await writeFile(LOCK_FILE, String(process.pid), { flag: "wx" });
      await new Promise(r => setTimeout(r, 50));
      return;
    } catch {
      await new Promise(r => setTimeout(r, Math.min(100 * Math.pow(1.2, attempts), 2000)));
      attempts++;
    }
  }
  throw new Error("Could not acquire build test lock");
}

async function releaseLock(): Promise<void> {
  try {
    await rm(LOCK_FILE);
  } catch {
    // Lock file might not exist
  }
}

async function setupTempDir(): Promise<void> {
  await rm(TEST_TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEST_TEMP_DIR, { recursive: true });
}

async function cleanupTempDir(): Promise<void> {
  await rm(TEST_TEMP_DIR, { recursive: true, force: true });
}

describe.sequential("Build Validation Enhancements", () => {
  beforeAll(async () => {
    await acquireLock();
    await setupTempDir();
  });

  afterAll(async () => {
    await cleanupTempDir();
    await releaseLock();
  });

  it("should successfully validate a normal build", async () => {
    // Clear MODULAR_BUILD env var
    const originalEnv = process.env.MODULAR_BUILD;
    delete process.env.MODULAR_BUILD;

    try {
      // This should succeed without throwing
      await buildProject(false);

      // If we get here, validation passed
      expect(true).toBe(true);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      }
    }
  });

  it("should successfully validate a modular build", async () => {
    const originalEnv = process.env.MODULAR_BUILD;
    process.env.MODULAR_BUILD = "true";

    try {
      // This should succeed without throwing
      await buildProject(false);

      // If we get here, validation passed
      expect(true).toBe(true);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      } else {
        delete process.env.MODULAR_BUILD;
      }
    }
  });

  it("should detect missing file", async () => {
    const nonExistentPath = resolve(TEST_TEMP_DIR, "nonexistent.js");

    await expect(async () => {
      await validateFile(nonExistentPath, "nonexistent.js", false);
    }).rejects.toThrow("was not generated");
  });

  it("should detect empty file", async () => {
    const emptyPath = resolve(TEST_TEMP_DIR, "empty.js");
    await writeFile(emptyPath, "");

    await expect(async () => {
      await validateFile(emptyPath, "empty.js", false);
    }).rejects.toThrow("is empty");
  });

  it("should detect suspiciously small file", async () => {
    const smallPath = resolve(TEST_TEMP_DIR, "small.js");
    // Create a file with only 100 bytes (below 500 byte threshold)
    await writeFile(smallPath, "// Small file\n".padEnd(100, " "));

    await expect(async () => {
      await validateFile(smallPath, "small.js", false);
    }).rejects.toThrow("suspiciously small");
  });

  it("should accept file above minimum size threshold", async () => {
    const validPath = resolve(TEST_TEMP_DIR, "valid.js");
    // Create a file with 600 bytes (above 500 byte threshold)
    const content = "// Valid file with sufficient content\n".padEnd(600, " ");
    await writeFile(validPath, content);

    // Should not throw
    await validateFile(validPath, "valid.js", false);
    expect(true).toBe(true);
  });

  it("should detect missing loop export in main.js", async () => {
    const noLoopPath = resolve(TEST_TEMP_DIR, "no-loop.js");
    // Create a file without loop export but above 50KB threshold
    const content = `
      // Valid JavaScript without loop export
      var module = {};
      var exports = {};
      function someFunction() {
        console.log("This is not the loop function");
      }
      module.exports = { someFunction };
    `.padEnd(51000, " ");

    await writeFile(noLoopPath, content);

    await expect(async () => {
      await validateFile(noLoopPath, "no-loop.js", true);
    }).rejects.toThrow("does not export loop function");
  });

  it("should accept file with exports.loop pattern", async () => {
    const path = resolve(TEST_TEMP_DIR, "exports-loop.js");
    const content = `
      "use strict";
      var exports = {};
      exports.loop = function() {
        console.log("tick");
      };
    `.padEnd(51000, " ");

    await writeFile(path, content);
    await validateFile(path, "exports-loop.js", true);
    expect(true).toBe(true);
  });

  it("should accept file with export { loop } pattern", async () => {
    const path = resolve(TEST_TEMP_DIR, "export-loop.js");
    const content = `
      "use strict";
      function loop() {
        console.log("tick");
      }
      export { loop };
    `.padEnd(51000, " ");

    await writeFile(path, content);
    await validateFile(path, "export-loop.js", true);
    expect(true).toBe(true);
  });

  it("should accept file with export function loop pattern", async () => {
    const path = resolve(TEST_TEMP_DIR, "export-func-loop.js");
    const content = `
      "use strict";
      export function loop() {
        console.log("tick");
      }
    `.padEnd(51000, " ");

    await writeFile(path, content);
    await validateFile(path, "export-func-loop.js", true);
    expect(true).toBe(true);
  });

  it("should accept file with esbuild CommonJS pattern (loop: () => loop)", async () => {
    const path = resolve(TEST_TEMP_DIR, "esbuild-loop.js");
    const content = `
      "use strict";
      var __export = function(exports, props) {
        for (var key in props) exports[key] = props[key];
      };
      var main_exports = {};
      __export(main_exports, {
        loop: () => loop
      });
      var loop = () => {
        console.log("tick");
      };
      module.exports = main_exports;
    `.padEnd(51000, " ");

    await writeFile(path, content);
    await validateFile(path, "esbuild-loop.js", true);
    expect(true).toBe(true);
  });

  it("should accept file with module.exports containing loop", async () => {
    const path = resolve(TEST_TEMP_DIR, "module-exports-loop.js");
    const content = `
      "use strict";
      var loop = function() {
        console.log("tick");
      };
      module.exports = { loop: loop };
    `.padEnd(51000, " ");

    await writeFile(path, content);
    await validateFile(path, "module-exports-loop.js", true);
    expect(true).toBe(true);
  });

  // Context-aware threshold tests (50KB for main.js, 500B for modules)
  it("should reject suspiciously small main.js (< 50KB)", async () => {
    const smallMainPath = resolve(TEST_TEMP_DIR, "small-main.js");
    // Create 1KB main.js with loop export but below 50KB threshold
    const content = `
      "use strict";
      var exports = {};
      exports.loop = function() {
        console.log("tick");
      };
    `.padEnd(1000, " ");

    await writeFile(smallMainPath, content);

    await expect(async () => {
      await validateFile(smallMainPath, "small-main.js", true);
    }).rejects.toThrow("suspiciously small");
  });

  it("should accept large main.js (> 50KB)", async () => {
    const largeMainPath = resolve(TEST_TEMP_DIR, "large-main.js");
    // Create 60KB main.js with loop export
    const content = `
      "use strict";
      var exports = {};
      exports.loop = function() {
        console.log("tick");
      };
    `.padEnd(60000, " ");

    await writeFile(largeMainPath, content);
    await validateFile(largeMainPath, "large-main.js", true);
    expect(true).toBe(true);
  });

  it("should accept small modules (> 500B)", async () => {
    const smallModulePath = resolve(TEST_TEMP_DIR, "small-module.js");
    // Create 600B module (no loop check)
    const content = `
      "use strict";
      exports.someFunction = function() {
        console.log("module function");
      };
    `.padEnd(600, " ");

    await writeFile(smallModulePath, content);
    await validateFile(smallModulePath, "small-module.js", false);
    expect(true).toBe(true);
  });

  it("should reject tiny modules (< 500B)", async () => {
    const tinyModulePath = resolve(TEST_TEMP_DIR, "tiny-module.js");
    // Create 100B module (below 500B threshold)
    const content = "// Tiny module\n".padEnd(100, " ");

    await writeFile(tinyModulePath, content);

    await expect(async () => {
      await validateFile(tinyModulePath, "tiny-module.js", false);
    }).rejects.toThrow("suspiciously small");
  });
});
