import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";

describe("Deploy Workflow Version Resolution - Modernized CI/CD", () => {
  it("should use tag push version resolution logic", () => {
    // The modernized deploy workflow uses multiple trigger mechanisms:
    // - workflow_run events: triggered by post-merge-release completion
    // - push events (tags): extract from github.ref_name
    // - workflow_dispatch events: use inputs.version or git describe fallback
    // - No release event handling (doesn't work with GITHUB_TOKEN)

    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify the workflow has the tag ref logic for push events
    expect(workflowContent).toContain("github.ref_name");
    expect(workflowContent).toContain("github.event_name");
    expect(workflowContent).toContain("push");

    // Should not have release event handling (doesn't work with GITHUB_TOKEN)
    expect(workflowContent).not.toContain("github.event.release.tag_name");

    // Should have workflow_run logic for post-merge-release coordination
    expect(workflowContent).toContain("workflow_run");
  });

  it("should trigger on tag push events and workflow_run", () => {
    const workflowContent = readFileSync(join(process.cwd(), ".github/workflows/deploy.yml"), "utf-8");

    // Verify trigger mechanism (push tags v*)
    expect(workflowContent).toContain("on:");
    expect(workflowContent).toContain("push:");
    expect(workflowContent).toContain("tags:");
    expect(workflowContent).toContain("v*");

    // Should NOT have release trigger (doesn't work with GITHUB_TOKEN)
    expect(workflowContent).not.toContain("release:");

    // Should have workflow_run trigger for post-merge-release coordination
    expect(workflowContent).toContain("workflow_run:");
    expect(workflowContent).toContain("Post Merge Release");
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
