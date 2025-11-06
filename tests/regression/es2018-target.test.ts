/**
 * Regression test for ES2018 target compliance
 *
 * This test ensures that the build system correctly targets ES2018
 * for Screeps compatibility, not higher ES versions like ES2021.
 *
 * Related issue: ensure deployed code to screeps is es2018
 */

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProject } from "../../scripts/buildProject";

describe.sequential("ES2018 Target Compliance", () => {
  it("should not contain ES2021 logical assignment operators", async () => {
    await buildProject(false);

    const mainJsPath = resolve("dist", "main.js");
    const content = await readFile(mainJsPath, "utf8");

    // ES2021 logical assignment operators: ??=, ||=, &&=
    // These should not appear in ES2018 output
    expect(content).not.toMatch(/\?\?=/);
    expect(content).not.toMatch(/\|\|=/);
    expect(content).not.toMatch(/&&=/);
  });

  it("should build successfully with es2018 target", async () => {
    // This should complete without errors
    await expect(buildProject(false)).resolves.toBeUndefined();
  });

  it("should generate valid JavaScript output", async () => {
    await buildProject(false);

    const mainJsPath = resolve("dist", "main.js");
    const content = await readFile(mainJsPath, "utf8");

    // Should have actual content
    expect(content.length).toBeGreaterThan(0);

    // Should be valid CommonJS format
    expect(content).toContain("module.exports");

    // Should contain the main loop export
    expect(content).toMatch(/loop/);
  });

  it("modular build should also target es2018", async () => {
    const originalEnv = process.env.MODULAR_BUILD;
    process.env.MODULAR_BUILD = "true";

    try {
      await buildProject(false);

      const mainJsPath = resolve("dist", "main.js");
      const content = await readFile(mainJsPath, "utf8");

      // Should not contain ES2021 features
      expect(content).not.toMatch(/\?\?=/);
      expect(content).not.toMatch(/\|\|=/);
      expect(content).not.toMatch(/&&=/);

      // Check a runtime module as well
      const behaviorJsPath = resolve("dist", "behavior.js");
      const behaviorContent = await readFile(behaviorJsPath, "utf8");

      expect(behaviorContent).not.toMatch(/\?\?=/);
      expect(behaviorContent).not.toMatch(/\|\|=/);
      expect(behaviorContent).not.toMatch(/&&=/);
    } finally {
      if (originalEnv !== undefined) {
        process.env.MODULAR_BUILD = originalEnv;
      } else {
        delete process.env.MODULAR_BUILD;
      }
    }
  });
});
