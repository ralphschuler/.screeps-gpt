import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("Deploy Workflow Version Resolution - Modernized CI/CD", () => {
  it("should use simplified version resolution logic", () => {
    // The modernized deploy workflow uses simplified version resolution:
    // - Tag push events: extract from github.ref_name only
    // - No release event handling (doesn't work with GITHUB_TOKEN)
    // No more complex fallback logic needed

    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify the workflow has the simplified logic
    expect(workflowContent).toContain("github.ref_name");

    // Should not have release event handling (doesn't work with GITHUB_TOKEN)
    expect(workflowContent).not.toContain("github.event.release.tag_name");

    // Should not have the old complex fallback logic
    expect(workflowContent).not.toContain("git tag --points-at");
    expect(workflowContent).not.toContain("workflow_run.head_sha");
  });

  it("should trigger on release events", () => {
    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify trigger mechanism (GitHub Release events)
    expect(workflowContent).toContain("on:");
    expect(workflowContent).toContain("release:");

    // Should NOT have old tag push trigger
    expect(workflowContent).not.toContain('tags:\n      - "v*"');
  });

  it("should use GitHub production environment", () => {
    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify environment configuration
    expect(workflowContent).toContain("environment:");
    expect(workflowContent).toContain("name: production");
    expect(workflowContent).toContain("url: https://screeps.com");
  });

  it("should handle version tags correctly when they exist", () => {
    // Test the git logic only if version tags exist in the repository
    const allTags = execSync('git tag -l "v*"', {
      encoding: "utf-8"
    }).trim();

    if (allTags) {
      // If we have tags, verify they follow the version pattern
      const latestTag = execSync('git tag -l "v*" | sort -V | tail -n 1', {
        encoding: "utf-8"
      }).trim();

      expect(latestTag).toMatch(/^v\d+\.\d+\.\d+$/);
    } else {
      // If no tags exist yet (e.g., on a feature branch), that's okay
      // The first release will create the initial tag
      expect(allTags).toBe("");
    }
  });
});
