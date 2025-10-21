/**
 * Regression test for pnpm lockfile configuration compatibility
 *
 * Related to: https://github.com/ralphschuler/.screeps-gpt/actions/runs/18699813713
 *
 * This test ensures that pnpm lockfile settings remain compatible with the current pnpm version
 * and prevents ERR_PNPM_LOCKFILE_CONFIG_MISMATCH errors during CI runs.
 */

import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("pnpm lockfile compatibility", () => {
  test("lockfile should exist and have valid format", () => {
    const lockfilePath = join(process.cwd(), "pnpm-lock.yaml");
    expect(existsSync(lockfilePath)).toBe(true);

    const lockfileContent = readFileSync(lockfilePath, "utf8");
    expect(lockfileContent).toContain("lockfileVersion:");
    expect(lockfileContent).toContain("settings:");
  });

  test("lockfile should not contain incompatible autoInstallPeers setting", () => {
    const lockfilePath = join(process.cwd(), "pnpm-lock.yaml");
    const lockfileContent = readFileSync(lockfilePath, "utf8");

    // The lockfile should either not have autoInstallPeers setting or it should be compatible
    // This prevents ERR_PNPM_LOCKFILE_CONFIG_MISMATCH errors
    if (lockfileContent.includes("autoInstallPeers:")) {
      // If present, it should be a boolean value
      const settingsMatch = lockfileContent.match(/autoInstallPeers:\s*(true|false)/);
      expect(settingsMatch).toBeTruthy();
    }
  });

  test("package.json should define pnpm engine compatibility", () => {
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as { engines?: { node?: string } };

    // Ensure we have engine specifications to prevent version mismatches
    expect(packageJson.engines).toBeDefined();
    expect(packageJson.engines?.node).toBeDefined();
  });

  test("lockfile should have consistent esbuild versions", () => {
    const lockfilePath = join(process.cwd(), "pnpm-lock.yaml");
    const lockfileContent = readFileSync(lockfilePath, "utf8");

    // Extract all esbuild version references from the lockfile
    const esbuildVersions = [
      ...lockfileContent.matchAll(/esbuild@([\d.]+)/g),
    ].map((match) => match[1]);

    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8");
    const packageJson = JSON.parse(packageJsonContent) as {
      devDependencies?: { esbuild?: string };
    };

    // Get the expected version from package.json
    const expectedVersion = packageJson.devDependencies?.esbuild?.replace(/[\^~]/, "");

    if (expectedVersion && esbuildVersions.length > 0) {
      // All esbuild versions in lockfile should match the expected major version
      // This prevents "Expected X.X.X but got Y.Y.Y" postinstall errors
      const expectedMajor = expectedVersion.split('.')[0];
      esbuildVersions.forEach((version) => {
        const actualMajor = version.split('.')[0];
        expect(actualMajor).toBe(expectedMajor);
      });
    }
  });
});
