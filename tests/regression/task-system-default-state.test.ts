/**
 * Regression test for task system default state consistency
 *
 * This test ensures that the build-time default for TASK_SYSTEM_ENABLED
 * matches the documented and expected runtime behavior.
 *
 * Issue: Task system was documented as "enabled by default (v0.32.0+)" but
 * buildProject.ts was setting process.env.TASK_SYSTEM_ENABLED to "false" by default,
 * causing the task system to be disabled unless explicitly enabled.
 *
 * Expected behavior:
 * - When TASK_SYSTEM_ENABLED env var is not set during build, task system should be enabled
 * - The bundled code should reflect this default (enabled state)
 * - Setting TASK_SYSTEM_ENABLED=false at build time should explicitly disable it
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProject } from "../../packages/utilities/scripts/lib/buildProject";

const LOCK_FILE = resolve("dist", ".test-lock");

async function acquireLock(): Promise<void> {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    try {
      await mkdir(resolve("dist"), { recursive: true });
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
    await unlink(LOCK_FILE);
  } catch {
    // Lock file might not exist
  }
}

describe.sequential("Task System Default State Regression", () => {
  let bundleContent: string;

  beforeAll(async () => {
    await acquireLock();

    // Clear TASK_SYSTEM_ENABLED to test default behavior
    const originalValue = process.env.TASK_SYSTEM_ENABLED;
    delete process.env.TASK_SYSTEM_ENABLED;

    try {
      await buildProject(false);

      // Read bundle content once for all tests
      const bundlePath = resolve("dist", "main.js");
      bundleContent = await readFile(bundlePath, "utf-8");
    } finally {
      // Restore original value
      if (originalValue !== undefined) {
        process.env.TASK_SYSTEM_ENABLED = originalValue;
      }
    }
  });

  afterAll(async () => {
    await releaseLock();
  });

  it("should have task system enabled by default when env var is not set", async () => {
    // Find the taskSystemEnabled variable definition in the bundle
    const taskSystemEnabledMatch = bundleContent.match(/var taskSystemEnabled = ([^;]+);/);

    expect(taskSystemEnabledMatch).not.toBeNull();

    if (taskSystemEnabledMatch) {
      const expression = taskSystemEnabledMatch[1];

      // The expression should evaluate to true when:
      // 1. process.env.TASK_SYSTEM_ENABLED is not "false" (first condition is false)
      // 2. process.env.TASK_SYSTEM_ENABLED is "true" (second condition is true, returns true)
      // 3. Or falls through to final default: true

      // With TASK_SYSTEM_ENABLED="true" at build time, the expression becomes:
      // false ? false : true ? true : ... (evaluates to true)
      expect(expression).toContain("true ? true");

      // Verify it doesn't start with the "false" check being true
      // (which would mean TASK_SYSTEM_ENABLED was set to "false")
      expect(expression).not.toMatch(/^true \? false/);
    }
  });

  it("should contain task system enabled logic in bundle", async () => {
    // Verify the bundle contains the task system initialization
    expect(bundleContent).toContain("taskSystemEnabled");
    expect(bundleContent).toContain("useTaskSystem");
  });

  it("should initialize BehaviorController with taskSystemEnabled value", async () => {
    // Verify BehaviorController is created with the taskSystemEnabled variable
    const behaviorControllerMatch = bundleContent.match(
      /new BehaviorController\({[^}]*useTaskSystem: taskSystemEnabled[^}]*}\)/s
    );

    expect(behaviorControllerMatch).not.toBeNull();
  });

  it("should preserve Memory.experimentalFeatures.taskSystem override capability", async () => {
    // Verify the bundle still checks Memory.experimentalFeatures
    expect(bundleContent).toContain("Memory");
    expect(bundleContent).toContain("experimentalFeatures");
    // The logic should allow Memory.experimentalFeatures.taskSystem to override
    expect(bundleContent).toContain("taskSystem");
  });
});

/**
 * Note: Testing TASK_SYSTEM_ENABLED=false requires setting the environment
 * variable before the build script is invoked. This test documents the expected
 * behavior, but comprehensive testing of the disabled state should be done via:
 *
 *   TASK_SYSTEM_ENABLED=false npm run build
 *
 * The bundled code will then start with "true ? false" which evaluates to false.
 */
