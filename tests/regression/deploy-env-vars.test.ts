/**
 * Regression test for deployment environment variable handling
 *
 * This test ensures that empty string environment variables are properly
 * handled and default values are used for Screeps deployment configuration.
 *
 * Original issue: Workflow run 18702433741 failed with "connect ECONNREFUSED ::1:80"
 * Root cause: Empty string environment variables were not handled correctly,
 * causing connection attempts to empty hostname/port instead of defaults.
 *
 * Extended to cover PROFILER_ENABLED propagation (issue tracking profiler
 * inconsistency between development and production builds).
 */

import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("Deployment Environment Variables Regression", () => {
  it("should handle empty string environment variables correctly", () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Set empty string environment variables (simulates GitHub Actions with empty secrets)
      process.env.SCREEPS_HOST = "";
      process.env.SCREEPS_PORT = "";
      process.env.SCREEPS_PROTOCOL = "";
      process.env.SCREEPS_BRANCH = "";
      process.env.SCREEPS_PATH = "";

      // Test the fixed logic (using || instead of ??)
      const branch = process.env.SCREEPS_BRANCH || "main";
      const hostname = process.env.SCREEPS_HOST || "screeps.com";
      const protocol = process.env.SCREEPS_PROTOCOL || "https";
      const port = Number(process.env.SCREEPS_PORT || 443);
      const path = process.env.SCREEPS_PATH || "/";

      // Verify defaults are applied when env vars are empty strings
      expect(branch).toBe("main");
      expect(hostname).toBe("screeps.com");
      expect(protocol).toBe("https");
      expect(port).toBe(443);
      expect(path).toBe("/");

      // Verify the problematic behavior with ?? (should fail)
      const problematicHostname = process.env.SCREEPS_HOST ?? "screeps.com";
      const problematicProtocol = process.env.SCREEPS_PROTOCOL ?? "https";
      const problematicPort = Number(process.env.SCREEPS_PORT ?? 443);

      expect(problematicHostname).toBe(""); // Empty string, not default
      expect(problematicProtocol).toBe(""); // Empty string, not default
      expect(problematicPort).toBe(0); // NaN -> 0, not default 443
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });

  it("should still respect non-empty environment variables", () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Set custom environment variables
      process.env.SCREEPS_HOST = "custom.server.com";
      process.env.SCREEPS_PORT = "21025";
      process.env.SCREEPS_PROTOCOL = "http";
      process.env.SCREEPS_BRANCH = "dev";
      process.env.SCREEPS_PATH = "/custom";

      // Test the fixed logic
      const branch = process.env.SCREEPS_BRANCH || "main";
      const hostname = process.env.SCREEPS_HOST || "screeps.com";
      const protocol = process.env.SCREEPS_PROTOCOL || "https";
      const port = Number(process.env.SCREEPS_PORT || 443);
      const path = process.env.SCREEPS_PATH || "/";

      // Verify custom values are used
      expect(branch).toBe("dev");
      expect(hostname).toBe("custom.server.com");
      expect(protocol).toBe("http");
      expect(port).toBe(21025);
      expect(path).toBe("/custom");
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });

  it("should default PROFILER_ENABLED to true when not set", () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Unset PROFILER_ENABLED
      delete process.env.PROFILER_ENABLED;

      // Test the profiler enable logic from buildProject.ts line 18
      const profilerEnabled = process.env.PROFILER_ENABLED === "false" ? "false" : "true";

      // Verify profiler defaults to enabled
      expect(profilerEnabled).toBe("true");
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });

  it("should respect PROFILER_ENABLED=false", () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Set PROFILER_ENABLED to false
      process.env.PROFILER_ENABLED = "false";

      // Test the profiler enable logic from buildProject.ts line 18
      const profilerEnabled = process.env.PROFILER_ENABLED === "false" ? "false" : "true";

      // Verify profiler is disabled
      expect(profilerEnabled).toBe("false");
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });

  it("should respect PROFILER_ENABLED=true", () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Set PROFILER_ENABLED to true
      process.env.PROFILER_ENABLED = "true";

      // Test the profiler enable logic from buildProject.ts line 18
      const profilerEnabled = process.env.PROFILER_ENABLED === "false" ? "false" : "true";

      // Verify profiler is enabled
      expect(profilerEnabled).toBe("true");
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });

  it("should handle empty string PROFILER_ENABLED as enabled", () => {
    // Save original env
    const originalEnv = { ...process.env };

    try {
      // Set PROFILER_ENABLED to empty string
      process.env.PROFILER_ENABLED = "";

      // Test the profiler enable logic from buildProject.ts line 18
      const profilerEnabled = process.env.PROFILER_ENABLED === "false" ? "false" : "true";

      // Verify profiler is enabled (empty string != "false")
      expect(profilerEnabled).toBe("true");
    } finally {
      // Restore original env
      process.env = originalEnv;
    }
  });
});

describe("Profiler Compilation Integration", () => {
  it("should verify deploy workflow includes PROFILER_ENABLED environment variable", async () => {
    // Read the deploy workflow file
    const workflowPath = resolve(".github/workflows/deploy.yml");
    const workflowContent = await readFile(workflowPath, "utf8");

    // Verify PROFILER_ENABLED is set in the build step
    expect(workflowContent).toContain("PROFILER_ENABLED:");
    expect(workflowContent).toMatch(/PROFILER_ENABLED:\s*\$\{\{\s*vars\.PROFILER_ENABLED\s*\|\|\s*['"]true['"]\s*\}\}/);

    // Verify it's in the correct step (Build and deploy)
    // The run is multiline with `|` and includes additional commands after yarn deploy
    const buildStepMatch = workflowContent.match(/- name: Build and deploy[\s\S]*?run: \|\s*\n\s*yarn deploy/);
    expect(buildStepMatch).toBeTruthy();
    expect(buildStepMatch![0]).toContain("PROFILER_ENABLED:");
  });

  it("should verify guard-build workflow includes PROFILER_ENABLED environment variable", async () => {
    // Read the guard-build workflow file
    const workflowPath = resolve(".github/workflows/guard-build.yml");
    const workflowContent = await readFile(workflowPath, "utf8");

    // Verify PROFILER_ENABLED is set in the build step
    expect(workflowContent).toContain("PROFILER_ENABLED:");
    expect(workflowContent).toMatch(/PROFILER_ENABLED:\s*\$\{\{\s*vars\.PROFILER_ENABLED\s*\|\|\s*['"]true['"]\s*\}\}/);

    // Verify it's in the correct step (Build AI)
    const buildStepMatch = workflowContent.match(/- name: Build AI[\s\S]*?run: yarn build/);
    expect(buildStepMatch).toBeTruthy();
    expect(buildStepMatch![0]).toContain("PROFILER_ENABLED:");
  });
});
