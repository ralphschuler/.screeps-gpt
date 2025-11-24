/**
 * Regression test for build validation threshold enhancement
 *
 * This test ensures that build validation correctly enforces size thresholds
 * based on build type:
 * - main.js (loop export): 50KB minimum (ensures functional AI with kernel + runtime)
 * - modules (no loop export): 500 bytes minimum (allows small type-only modules)
 *
 * Related issue: ralphschuler/.screeps-gpt#729 - Increase MIN_SIZE threshold
 * Related PR: ralphschuler/.screeps-gpt#706 - Original validation implementation
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { validateFile } from "../../packages/utilities/scripts/lib/buildProject";

const TEST_DIR = resolve(tmpdir(), "build-validation-test");

describe("Build Validation Threshold Regression", () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test files
    try {
      const testFiles = [
        "tiny-main.js",
        "small-main.js",
        "valid-main.js",
        "main-no-loop.js",
        "tiny-module.js",
        "valid-module-500b.js",
        "valid-type-module.js",
        "empty.js"
      ];
      for (const file of testFiles) {
        await unlink(resolve(TEST_DIR, file)).catch(() => {});
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("main.js validation (checkLoopExport=true)", () => {
    it("should reject main.js smaller than 50KB", async () => {
      // Create a 1KB file (too small for functional AI)
      const tinyMainPath = resolve(TEST_DIR, "tiny-main.js");
      const tinyContent = "exports.loop = () => {};\n" + "a".repeat(1000);
      await writeFile(tinyMainPath, tinyContent);

      await expect(validateFile(tinyMainPath, "main.js", true)).rejects.toThrow(/suspiciously small.*expected >50000/);
    });

    it("should reject main.js just under 50KB threshold", async () => {
      // Create a 49,900 byte file with loop export (just under 50,000 bytes)
      const smallMainPath = resolve(TEST_DIR, "small-main.js");
      const loopExport = "exports.loop = () => {};\n";
      const smallContent = loopExport + "a".repeat(49900 - loopExport.length);
      await writeFile(smallMainPath, smallContent);

      await expect(validateFile(smallMainPath, "main.js", true)).rejects.toThrow(/suspiciously small.*expected >50000/);
    });

    it("should accept main.js at 50KB or larger", async () => {
      // Create a 50KB file with loop export (exactly 50,000 bytes)
      const validMainPath = resolve(TEST_DIR, "valid-main.js");
      const loopExport = "exports.loop = () => {};\n";
      const validContent = loopExport + "a".repeat(50000 - loopExport.length);
      await writeFile(validMainPath, validContent);

      await expect(validateFile(validMainPath, "main.js", true)).resolves.not.toThrow();
    });

    it("should reject main.js without loop export", async () => {
      // Create a 50KB file WITHOUT loop export
      const noLoopMainPath = resolve(TEST_DIR, "main-no-loop.js");
      const invalidContent = "// No loop export\n" + "a".repeat(50000);
      await writeFile(noLoopMainPath, invalidContent);

      await expect(validateFile(noLoopMainPath, "main.js", true)).rejects.toThrow(/does not export loop function/);
    });

    it("should reject empty main.js", async () => {
      const emptyPath = resolve(TEST_DIR, "empty.js");
      await writeFile(emptyPath, "");

      await expect(validateFile(emptyPath, "main.js", true)).rejects.toThrow(/is empty/);
    });
  });

  describe("module validation (checkLoopExport=false)", () => {
    it("should reject module smaller than 500 bytes", async () => {
      // Create a 400-byte module (too small)
      const tinyModulePath = resolve(TEST_DIR, "tiny-module.js");
      const tinyContent = "a".repeat(400);
      await writeFile(tinyModulePath, tinyContent);

      await expect(validateFile(tinyModulePath, "behavior.js", false)).rejects.toThrow(
        /suspiciously small.*expected >500/
      );
    });

    it("should accept module at 500 bytes or larger", async () => {
      // Create a 500-byte module (minimum valid size)
      const validModulePath = resolve(TEST_DIR, "valid-module-500b.js");
      const validContent = "a".repeat(500);
      await writeFile(validModulePath, validContent);

      await expect(validateFile(validModulePath, "behavior.js", false)).resolves.not.toThrow();
    });

    it("should accept small type-only modules (>500 bytes)", async () => {
      // Create a realistic small type-only module (837 bytes, like types.js)
      const typeModulePath = resolve(TEST_DIR, "valid-type-module.js");
      const typeContent = `
// Type definitions module
export interface GameContext {
  cpu: number;
  memory: Memory;
}
export type RoleType = "harvester" | "upgrader" | "builder";
export const ROLES = ["harvester", "upgrader", "builder"] as const;
`.repeat(10); // Make it larger than 500 bytes
      await writeFile(typeModulePath, typeContent);

      await expect(validateFile(typeModulePath, "types.js", false)).resolves.not.toThrow();
    });

    it("should reject empty modules", async () => {
      const emptyPath = resolve(TEST_DIR, "empty.js");
      await writeFile(emptyPath, "");

      await expect(validateFile(emptyPath, "behavior.js", false)).rejects.toThrow(/is empty/);
    });
  });

  describe("edge cases", () => {
    it("should provide helpful error messages with file size", async () => {
      const tinyPath = resolve(TEST_DIR, "tiny-module.js");
      await writeFile(tinyPath, "a".repeat(100));

      try {
        await validateFile(tinyPath, "test.js", false);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect((error as Error).message).toMatch(/100 bytes/);
        expect((error as Error).message).toMatch(/expected >500/);
      }
    });

    it("should throw error for non-existent files", async () => {
      const nonExistentPath = resolve(TEST_DIR, "does-not-exist.js");

      await expect(validateFile(nonExistentPath, "missing.js", false)).rejects.toThrow(/was not generated/);
    });
  });
});
