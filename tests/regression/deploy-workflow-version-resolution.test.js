import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("Deploy Workflow Version Resolution - Modernized CI/CD", () => {
  it("should use workflow_run version resolution logic", () => {
    // The modernized deploy workflow uses workflow_run version resolution:
    // - workflow_run events: extract from git describe --tags --abbrev=0
    // - workflow_dispatch events: use inputs.version or package.json fallback
    // - No release event handling (doesn't work with GITHUB_TOKEN)

    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify the workflow has the git tags logic for workflow_run
    expect(workflowContent).toContain("git describe --tags --abbrev=0");
    expect(workflowContent).toContain("github.event_name");
    expect(workflowContent).toContain("workflow_run");

    // Should not have release event handling (doesn't work with GITHUB_TOKEN)
    expect(workflowContent).not.toContain("github.event.release.tag_name");

    // Should not have the old github.ref_name logic (for tag push events)
    expect(workflowContent).not.toContain("github.ref_name");
  });

  it("should trigger on workflow_run events", () => {
    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify trigger mechanism (workflow_run from Post Merge Release)
    expect(workflowContent).toContain("on:");
    expect(workflowContent).toContain("workflow_run:");
    expect(workflowContent).toContain("Post Merge Release");

    // Should NOT have release trigger (doesn't work with GITHUB_TOKEN)
    expect(workflowContent).not.toContain("release:");

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
