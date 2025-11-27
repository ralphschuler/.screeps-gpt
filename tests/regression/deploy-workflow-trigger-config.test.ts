/**
 * Regression test for deploy workflow trigger configuration
 *
 * This test ensures the deploy workflow maintains the correct trigger configuration
 * to deploy when version tags are pushed to the repository.
 *
 * Issue Context:
 * The deployment lifecycle follows: feature branch → PR → main → create tag → deploy
 * The deploy workflow is triggered by tag pushes (matching v* pattern) which are
 * created by the post-merge-release workflow after merging to main.
 *
 * Fix Commit: e0714e8
 * Related Issue: #242
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
  environment?: {
    name: string;
    url: string;
  };
  steps: WorkflowStep[];
}

interface Workflow {
  name: string;
  on: {
    push?: {
      tags?: string[];
    };
    release?: {
      types?: string[];
    };
    workflow_run?: unknown;
  };
  concurrency?: {
    group: string;
    "cancel-in-progress": boolean;
  };
  jobs: {
    deploy: WorkflowJob;
  };
}

describe("Deploy workflow trigger configuration", () => {
  const workflowPath = ".github/workflows/deploy.yml";
  let workflow: Workflow;

  it("should load deploy workflow file", () => {
    const content = readFileSync(workflowPath, "utf8");
    workflow = YAML.parse(content) as Workflow;
    expect(workflow).toBeDefined();
  });

  it("should have push trigger with tags", () => {
    // Deploy workflow is triggered by tag pushes (v* pattern)
    expect(workflow.on).toBeDefined();
    expect(workflow.on.push).toBeDefined();
    expect(workflow.on.push.tags).toBeDefined();
    expect(workflow.on.push.tags).toContain("v*");
  });

  it("should NOT have release trigger", () => {
    // Using push.tags trigger instead of release.published
    expect(workflow.on.release).toBeUndefined();
  });

  it("should have workflow_run trigger for Post Merge Release", () => {
    // Using workflow_run trigger to ensure deploy runs after post-merge-release succeeds
    expect(workflow.on.workflow_run).toBeDefined();
    const workflowRun = workflow.on.workflow_run as {
      workflows: string[];
      types: string[];
    };
    expect(workflowRun.workflows).toContain("Post Merge Release");
    expect(workflowRun.types).toContain("completed");
  });

  it("should extract version from tag ref for push events", () => {
    const getVersionStep = workflow.jobs.deploy.steps.find(step => step.id === "get_version");

    expect(getVersionStep).toBeDefined();
    expect(getVersionStep?.run).toContain("github.ref_name");
    expect(getVersionStep?.run).toContain('echo "version=$VERSION"');
  });

  it("should have conditional logic for different event types", () => {
    const getVersionStep = workflow.jobs.deploy.steps.find(step => step.id === "get_version");

    // Should check for push, workflow_run, and manual dispatch event types
    expect(getVersionStep?.run).toContain("github.event_name");
    expect(getVersionStep?.run).toContain("push");
    expect(getVersionStep?.run).toContain("workflow_run");
    expect(getVersionStep?.run).toContain("workflow_dispatch");
  });

  it("should include notice logging", () => {
    const getVersionStep = workflow.jobs.deploy.steps.find(step => step.id === "get_version");

    expect(getVersionStep?.run).toContain("::notice::");
  });

  it("should have production environment configured", () => {
    expect(workflow.jobs.deploy.environment).toBeDefined();
    expect(workflow.jobs.deploy.environment.name).toBe("production");
    expect(workflow.jobs.deploy.environment.url).toBe("https://screeps.com");
  });

  it("should use Node.js for deployment", () => {
    const setupNodeStep = workflow.jobs.deploy.steps.find(step => step.name === "Setup Node.js");

    expect(setupNodeStep).toBeDefined();
    expect(setupNodeStep?.uses).toContain("actions/setup-node");
  });

  it("should run build and deploy step", () => {
    const deployStep = workflow.jobs.deploy.steps.find(step => step.id === "deploy");

    expect(deployStep).toBeDefined();
    // The run is now multiline with `|` to include deployment timestamp output
    expect(deployStep?.run).toContain("yarn deploy");
  });

  it("should have required secrets configured", () => {
    const deployStep = workflow.jobs.deploy.steps.find(step => step.id === "deploy");

    expect(deployStep?.env).toBeDefined();
    expect(deployStep?.env?.SCREEPS_TOKEN).toBe("${{ secrets.SCREEPS_TOKEN }}");
    expect(deployStep?.env?.SCREEPS_HOST).toBe("${{ vars.SCREEPS_HOST }}");
  });

  it("should have autospawn step after deployment", () => {
    const autospawnStep = workflow.jobs.deploy.steps.find(step => step.id === "autospawn");

    expect(autospawnStep).toBeDefined();
    expect(autospawnStep?.uses).toContain("./.github/actions/screeps-autospawner");
    // Autospawn only runs after health check passes to avoid spawning if deployment failed
    expect(autospawnStep?.if).toContain("success()");
  });

  it("should send notifications on success and failure", () => {
    const successNotification = workflow.jobs.deploy.steps.find(step => step.name === "Notify deployment success");

    const failureNotification = workflow.jobs.deploy.steps.find(step => step.name === "Notify deployment failure");

    expect(successNotification).toBeDefined();
    // Success notification only runs after health check passes
    expect(successNotification?.if).toContain("success()");

    expect(failureNotification).toBeDefined();
    expect(failureNotification?.if).toBe("failure()");
  });

  it("should have concurrency control", () => {
    expect(workflow.concurrency).toBeDefined();
    expect(workflow.concurrency?.group).toContain("deploy-");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });

  it("should have conditional job execution based on workflow_run success", () => {
    // Deploy job should only run if workflow_run succeeded or triggered by push/dispatch
    expect(workflow.jobs.deploy.if).toBeDefined();
    const condition = workflow.jobs.deploy.if as string;
    expect(condition).toContain("workflow_run");
    expect(condition).toContain("workflow_run.conclusion");
    expect(condition).toContain("success");
    expect(condition).toContain("workflow_dispatch");
    expect(condition).toContain("push");
  });
});
