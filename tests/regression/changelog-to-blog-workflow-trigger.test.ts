/**
 * Regression test for changelog-to-blog workflow trigger configuration
 *
 * This test ensures the changelog-to-blog workflow maintains correct trigger
 * configuration to generate blog posts after post-merge-release completes.
 *
 * Issue Context:
 * The post-merge-release workflow creates a tag and triggers blog generation via workflow_run.
 * Blog generation and tag-triggered deployment now happen in parallel after post-merge-release completes,
 * with workflow_run (post-merge-release completion) and tag push events (v* pattern) both triggering the workflow for compatibility.
 *
 * Related Issue: Trigger deploy and blog workflows after post-merge-release completion
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import * as YAML from "yaml";

interface WorkflowStep {
  id?: string;
  name?: string;
  uses?: string;
  run?: string;
  if?: string;
  env?: Record<string, string>;
}

interface WorkflowJob {
  "runs-on": string;
  if?: string;
  "timeout-minutes": number;
  steps: WorkflowStep[];
}

interface Workflow {
  name: string;
  on: {
    push?: {
      tags?: string[];
    };
    workflow_run?: {
      workflows: string[];
      types: string[];
    };
    workflow_dispatch?: {
      inputs?: Record<string, unknown>;
    };
  };
  concurrency?: {
    group: string;
    "cancel-in-progress": boolean;
  };
  jobs: {
    "generate-blog-post": WorkflowJob;
  };
}

describe("Changelog to Blog workflow trigger configuration", () => {
  const workflowPath = ".github/workflows/copilot-changelog-to-blog.yml";
  let workflow: Workflow;

  it("should load changelog-to-blog workflow file", () => {
    const content = readFileSync(workflowPath, "utf8");
    workflow = YAML.parse(content) as Workflow;
    expect(workflow).toBeDefined();
  });

  it("should have workflow_run trigger for Post Merge Release", () => {
    // Using workflow_run trigger to ensure blog runs after post-merge-release succeeds
    expect(workflow.on).toBeDefined();
    expect(workflow.on.workflow_run).toBeDefined();
    expect(workflow.on.workflow_run.workflows).toContain("Post Merge Release");
    expect(workflow.on.workflow_run.types).toContain("completed");
  });

  it("should have push trigger with tags for backward compatibility", () => {
    // Maintain tag push trigger as backup mechanism
    expect(workflow.on.push).toBeDefined();
    expect(workflow.on.push.tags).toBeDefined();
    expect(workflow.on.push.tags).toContain("v*");
  });

  it("should have workflow_dispatch trigger for manual execution", () => {
    // Allow manual blog post generation
    expect(workflow.on.workflow_dispatch).toBeDefined();
    expect(workflow.on.workflow_dispatch.inputs).toBeDefined();
  });

  it("should have conditional job execution based on workflow_run success", () => {
    // Blog job should only run if workflow_run succeeded or triggered by push/dispatch
    expect(workflow.jobs["generate-blog-post"].if).toBeDefined();
    const condition = workflow.jobs["generate-blog-post"].if as string;
    expect(condition).toContain("workflow_run");
    expect(condition).toContain("workflow_run.conclusion");
    expect(condition).toContain("success");
    expect(condition).toContain("workflow_dispatch");
    expect(condition).toContain("push");
  });

  it("should extract version from workflow_run event", () => {
    const versionStep = workflow.jobs["generate-blog-post"].steps.find(step => step.id === "version");

    expect(versionStep).toBeDefined();
    expect(versionStep?.run).toContain("workflow_run");
    expect(versionStep?.run).toContain("git describe --tags");
  });

  it("should handle different event types in version extraction", () => {
    const versionStep = workflow.jobs["generate-blog-post"].steps.find(step => step.id === "version");

    // Should check for workflow_dispatch, workflow_run, and push event types
    expect(versionStep?.run).toContain("github.event_name");
    expect(versionStep?.run).toContain("workflow_dispatch");
    expect(versionStep?.run).toContain("workflow_run");
  });

  it("should check if blog post already exists", () => {
    const checkStep = workflow.jobs["generate-blog-post"].steps.find(step => step.id === "check");

    expect(checkStep).toBeDefined();
    expect(checkStep?.name).toBe("Check if blog post already exists");
  });

  it("should generate blog post with Copilot", () => {
    const generateStep = workflow.jobs["generate-blog-post"].steps.find(
      step => step.name === "Generate blog post with Copilot"
    );

    expect(generateStep).toBeDefined();
    expect(generateStep?.uses).toContain("./.github/actions/codex-exec");
    expect(generateStep?.if).toContain("steps.check.outputs.exists == 'false'");
  });

  it("should verify blog post creation", () => {
    const verifyStep = workflow.jobs["generate-blog-post"].steps.find(
      step => step.name === "Verify blog post was created"
    );

    expect(verifyStep).toBeDefined();
    expect(verifyStep?.if).toContain("steps.check.outputs.exists == 'false'");
  });

  it("should have proper timeout configuration", () => {
    expect(workflow.jobs["generate-blog-post"]["timeout-minutes"]).toBe(45);
  });

  it("should have concurrency control", () => {
    expect(workflow.concurrency).toBeDefined();
    expect(workflow.concurrency?.group).toBeDefined();
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });
});
