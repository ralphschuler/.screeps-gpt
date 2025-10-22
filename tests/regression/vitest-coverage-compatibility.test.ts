/**
 * @fileoverview Regression test for vitest and @vitest/coverage-v8 compatibility
 *
 * Ensures that the vitest main package and coverage plugin versions are compatible.
 *
 * **Issue**: Deploy Screeps AI workflow failed on workflow run 18705052117 due to
 * dependency conflict between vitest@3.2.4 and @vitest/coverage-v8@0.33.0.
 * The coverage plugin required vitest < 1.0 while project used vitest 3.2.4.
 *
 * **Fix**: Updated @vitest/coverage-v8 from ^0.33.0 to ^3.2.4 for compatibility.
 *
 * **Root cause**: Version mismatch between vitest core and coverage plugin during updates.
 *
 * This test prevents future vitest/coverage version conflicts by validating compatibility.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import semver from "semver";

interface PackageJson {
  devDependencies?: {
    vitest?: string;
    "@vitest/coverage-v8"?: string;
  };
}

describe("Vitest Coverage Compatibility Regression", () => {
  it("should have compatible vitest and @vitest/coverage-v8 versions", () => {
    // Read package.json to get current dependency versions
    const packageJsonPath = resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as PackageJson;

    const vitestVersion = packageJson.devDependencies?.vitest;
    const coverageVersion = packageJson.devDependencies?.["@vitest/coverage-v8"];

    expect(vitestVersion, "vitest should be in devDependencies").toBeDefined();
    expect(coverageVersion, "@vitest/coverage-v8 should be in devDependencies").toBeDefined();

    // Parse semver ranges to get major versions
    const vitestMajor = semver.major(semver.minVersion(vitestVersion)!);
    const coverageMajor = semver.major(semver.minVersion(coverageVersion)!);

    // Ensure major versions are compatible (should match for vitest 3.x+)
    expect(
      coverageMajor,
      `@vitest/coverage-v8 major version (${coverageMajor}) should match vitest major version (${vitestMajor}) to prevent dependency conflicts`
    ).toBe(vitestMajor);

    // Additional check: neither should be pinned to pre-1.0 versions when vitest is 3.x+
    if (vitestMajor >= 3) {
      expect(
        coverageMajor,
        "Coverage plugin should not be pinned to pre-1.0 versions when vitest is 3.x+"
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
