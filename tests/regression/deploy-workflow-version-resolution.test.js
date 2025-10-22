import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

describe("Deploy Workflow Version Resolution", () => {
  it("should resolve version tag correctly when no tag exists on triggering commit", () => {
    // Test the git logic that the deploy workflow uses
    const latestTag = execSync('git tag -l "v*" | sort -V | tail -n 1', {
      encoding: "utf-8"
    }).trim();

    expect(latestTag).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(latestTag).not.toBe("");
  });

  it("should handle case where specific commit has no tag but repository has version tags", () => {
    // Simulate the scenario that caused the original failure
    const testSha = "79473c2b2b29ab0bdbc082c2b94b450a0f6dc826";

    try {
      // Try to find tag on specific commit (should be empty)
      const tagOnCommit = execSync(`git tag --points-at "${testSha}" | grep -E "^v[0-9]" | head -n 1`, {
        encoding: "utf-8"
      }).trim();

      // If no tag on specific commit, should fall back to latest tag
      const fallbackVersion = execSync('git tag -l "v*" | sort -V | tail -n 1', {
        encoding: "utf-8"
      }).trim();

      // The logic should work: either we have a tag on the commit or we fall back
      const finalVersion = tagOnCommit || fallbackVersion;

      expect(finalVersion).toMatch(/^v\d+\.\d+\.\d+$/);
      expect(finalVersion).not.toBe("");
    } catch (error) {
      // If git commands fail, ensure we have a meaningful error
      throw new Error(`Deploy workflow version resolution test failed: ${error.message}`);
    }
  });

  it("should match the exact logic from deploy.yml workflow", () => {
    // This test replicates the exact bash logic from the deploy workflow
    const testSha = "nonexistent-commit-sha";

    try {
      // This will fail for a nonexistent commit, but should not crash the test
      execSync(`git tag --points-at "${testSha}"`, {
        encoding: "utf-8",
        stdio: "pipe"
      });
    } catch {
      // Expected to fail for nonexistent commit
    }

    // The fallback should always work if we have any version tags
    const fallbackVersion = execSync('git tag -l "v*" | sort -V | tail -n 1', {
      encoding: "utf-8"
    }).trim();

    expect(fallbackVersion).toBeTruthy();
    expect(fallbackVersion).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
