/**
 * @fileoverview Regression test for post-merge release workflow - Modernized CI/CD
 *
 * This test ensures that the post-merge release workflow uses modern GitHub DevOps practices:
 * - Direct commits to main (no release PRs)
 * - Semantic versioning based on conventional commits
 * - GitHub Release creation using native API
 * - Concurrency control to prevent race conditions
 *
 * Updated for: https://github.com/ralphschuler/.screeps-gpt/issues/122
 * Previous behavior (release PRs): https://github.com/ralphschuler/.screeps-gpt/actions/runs/18703919715
 */

import { describe, test, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Post Merge Release Workflow - Modernized CI/CD", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/post-merge-release.yml");

  test("workflow file should exist", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  test("workflow should use semantic versioning", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Check for semantic version bump step
    expect(workflowContent).toContain("name: Bump version (semantic)");
    expect(workflowContent).toContain("yarn version:bump-semantic");
    expect(workflowContent).toContain("BUMP_TYPE");
  });

  test("workflow should commit directly to main (no release branches)", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Check for direct commit to main
    expect(workflowContent).toContain("name: Commit version bump to main");
    expect(workflowContent).toContain("git push origin main");
    expect(workflowContent).toContain("[skip ci]");

    // Should NOT create release branches
    expect(workflowContent).not.toContain("RELEASE_BRANCH");
    expect(workflowContent).not.toContain("create_branch: true");
  });

  test("workflow should create GitHub Release using native API", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Check for GitHub Release creation
    expect(workflowContent).toContain("name: Create GitHub Release");
    expect(workflowContent).toContain("repos.createRelease");
    expect(workflowContent).toContain("generateReleaseNotes");
  });

  test("workflow should NOT create pull requests", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Should not have PR creation logic
    expect(workflowContent).not.toContain("pulls.create");
    expect(workflowContent).not.toContain("Create release branch and PR");
  });

  test("workflow should have concurrency group", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Check for concurrency control
    expect(workflowContent).toContain("concurrency:");
    expect(workflowContent).toContain("group: release-");
    expect(workflowContent).toContain("cancel-in-progress: false");
  });

  test("workflow should skip on release commits to prevent recursion", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Check for recursion prevention
    expect(workflowContent).toContain("chore(release):");
  });

  test("commit step should handle git race conditions", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Verify the workflow uses manual git commands for race condition handling
    expect(workflowContent).toContain("name: Commit version bump to main");
    expect(workflowContent).toContain("git fetch origin main");
    expect(workflowContent).toContain("git rebase origin/main");
    expect(workflowContent).toContain("git push origin main");

    // Verify it has retry logic for race conditions
    expect(workflowContent).toContain("MAX_RETRIES");
    expect(workflowContent).toContain("RETRY_COUNT");

    // Verify it commits to main with skip ci
    expect(workflowContent).toContain("[skip ci]");
  });
});
