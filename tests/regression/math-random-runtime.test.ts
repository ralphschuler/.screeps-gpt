/**
 * Regression test for deterministic runtime behavior
 *
 * Related to issue: ralphschuler/.screeps-gpt#174
 * Root cause: Math.random() usage in behavior controller broke deterministic AI behavior
 * Required for: reliable testing, debugging consistency, autonomous validation
 *
 * This test ensures no Math.random() usage exists in runtime code to maintain
 * deterministic behavior as outlined in repository coding standards.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { describe, it, expect } from "vitest";

function findTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findTypeScriptFiles(fullPath));
    } else if (item.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("Deterministic runtime requirements", () => {
  it("should not use Math.random() in runtime code", () => {
    const runtimePath = resolve(__dirname, "../../packages/bot/src/runtime");
    const runtimeFiles = findTypeScriptFiles(runtimePath);

    expect(runtimeFiles.length).toBeGreaterThan(0);

    const filesWithMathRandom: string[] = [];

    for (const file of runtimeFiles) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("Math.random(")) {
        filesWithMathRandom.push(file.replace(resolve(__dirname, "../.."), ""));
      }
    }

    expect(filesWithMathRandom).toEqual([]);
  });

  it("should use deterministic naming for creeps", () => {
    const roleControllerManagerPath = resolve(__dirname, "../../packages/bot/src/runtime/behavior/RoleControllerManager.ts");
    const content = readFileSync(roleControllerManagerPath, "utf-8");

    // Verify the creep naming pattern uses memory counter
    expect(content).toContain("memory.creepCounter");
    expect(content).not.toContain("Math.random");

    // Verify counter initialization exists (checking for initialization to 0 or other value)
    expect(content).toMatch(/memory\.creepCounter\s*=\s*\d+/);
  });
});
