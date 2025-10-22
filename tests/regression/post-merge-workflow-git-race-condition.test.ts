/**
 * @fileoverview Regression test for post-merge release workflow git race condition
 *
 * This test ensures that the post-merge release workflow handles concurrent
 * git operations properly to avoid "stale info" errors when using --force-with-lease.
 *
 * Related to: https://github.com/ralphschuler/.screeps-gpt/actions/runs/18703919715
 */

import { describe, test, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Post Merge Release Workflow Git Race Condition Prevention", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/post-merge-release.yml");

  test("workflow file should exist", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  test("workflow should have git ref refresh step before commit", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Check for the presence of the git refresh step
    expect(workflowContent).toContain("name: Update remote refs");
    expect(workflowContent).toContain("git fetch origin --prune");
    expect(workflowContent).toContain("git remote prune origin");

    // Verify it comes before the commit step
    const refreshStepIndex = workflowContent.indexOf("name: Update remote refs");
    const commitStepIndex = workflowContent.indexOf("name: Commit changes to release branch");

    expect(refreshStepIndex).toBeGreaterThan(-1);
    expect(commitStepIndex).toBeGreaterThan(-1);
    expect(refreshStepIndex).toBeLessThan(commitStepIndex);
  });

  test("git-auto-commit-action should have skip_fetch disabled", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Find the commit step
    const commitStepStart = workflowContent.indexOf("name: Commit changes to release branch");
    const nextStepStart = workflowContent.indexOf("name:", commitStepStart + 1);
    const commitStepContent = workflowContent.substring(
      commitStepStart,
      nextStepStart > -1 ? nextStepStart : workflowContent.length
    );

    expect(commitStepContent).toContain("stefanzweifel/git-auto-commit-action@v5");
    expect(commitStepContent).toContain("skip_fetch: false");
  });

  test("commit step should use force-with-lease for safety", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Find the commit step
    const commitStepStart = workflowContent.indexOf("name: Commit changes to release branch");
    const nextStepStart = workflowContent.indexOf("name:", commitStepStart + 1);
    const commitStepContent = workflowContent.substring(
      commitStepStart,
      nextStepStart > -1 ? nextStepStart : workflowContent.length
    );

    expect(commitStepContent).toContain("push_options: --force-with-lease");
  });

  test("workflow should have proper branch creation logic", () => {
    const workflowContent = fs.readFileSync(workflowPath, "utf8");

    // Find the commit step
    const commitStepStart = workflowContent.indexOf("name: Commit changes to release branch");
    const nextStepStart = workflowContent.indexOf("name:", commitStepStart + 1);
    const commitStepContent = workflowContent.substring(
      commitStepStart,
      nextStepStart > -1 ? nextStepStart : workflowContent.length
    );

    expect(commitStepContent).toContain("create_branch: true");
    expect(commitStepContent).toContain("branch: ${{ env.RELEASE_BRANCH }}");
  });
});
