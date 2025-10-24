/**
 * Regression test for deploy workflow trigger configuration
 *
 * This test ensures the deploy workflow maintains the correct trigger configuration
 * and prevents regression of the issue where a non-functional release.published
 * trigger caused confusion and skipped workflow runs.
 *
 * Issue Context:
 * GitHub Actions does not trigger release.published events when releases are
 * created by workflows using GITHUB_TOKEN (security measure to prevent recursive
 * workflow execution). The post-merge-release workflow creates releases using
 * GITHUB_TOKEN, so only the push.tags trigger works.
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

  it("should have release trigger", () => {
    // Deploy workflow is triggered by GitHub Release events created by post-merge workflow
    expect(workflow.on).toBeDefined();
    expect(workflow.on.release).toBeDefined();
  });

  it("should NOT have push trigger with tags", () => {
    // Using release trigger instead of push.tags for better integration with GitHub Releases
    expect(workflow.on.push).toBeUndefined();
  });

  it("should NOT have workflow_run trigger", () => {
    // workflow_run events were causing skipped runs
    expect(workflow.on.workflow_run).toBeUndefined();
  });

  it("should extract version from github.ref_name", () => {
    const getVersionStep = workflow.jobs.deploy.steps.find(step => step.id === "get_version");

    expect(getVersionStep).toBeDefined();
    expect(getVersionStep?.run).toContain("github.ref_name");
    expect(getVersionStep?.run).toContain('echo "version=$VERSION"');
  });

  it("should NOT have conditional logic for release events", () => {
    const getVersionStep = workflow.jobs.deploy.steps.find(step => step.id === "get_version");

    // Should not check for release event type
    expect(getVersionStep?.run).not.toContain("github.event_name");
    expect(getVersionStep?.run).not.toContain("release");
    expect(getVersionStep?.run).not.toContain("github.event.release.tag_name");
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

  it("should use Bun for deployment", () => {
    const setupBunStep = workflow.jobs.deploy.steps.find(step => step.name === "Setup Bun");

    expect(setupBunStep).toBeDefined();
    expect(setupBunStep?.uses).toContain("oven-sh/setup-bun");
  });

  it("should run build and deploy step", () => {
    const deployStep = workflow.jobs.deploy.steps.find(step => step.id === "deploy");

    expect(deployStep).toBeDefined();
    expect(deployStep?.run).toBe("bun run deploy");
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
    expect(autospawnStep?.if).toBe("success()");
  });

  it("should send notifications on success and failure", () => {
    const successNotification = workflow.jobs.deploy.steps.find(step => step.name === "Notify deployment success");

    const failureNotification = workflow.jobs.deploy.steps.find(step => step.name === "Notify deployment failure");

    expect(successNotification).toBeDefined();
    expect(successNotification?.if).toBe("success()");

    expect(failureNotification).toBeDefined();
    expect(failureNotification?.if).toBe("failure()");
  });

  it("should have concurrency control", () => {
    expect(workflow.concurrency).toBeDefined();
    expect(workflow.concurrency?.group).toContain("deploy-");
    expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
  });
});
