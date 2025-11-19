/**
 * Regression test for deploy workflow profiler auto-start
 *
 * This test ensures the deploy workflow automatically starts the profiler
 * after successful deployment when PROFILER_ENABLED is true.
 *
 * Issue Context:
 * The profiler integration was enabled but not starting automatically after
 * deployment, requiring manual console commands. The monitoring workflow
 * runs every 30 minutes, creating delays before profiler data is available.
 *
 * Solution:
 * Add a post-deployment step that calls ensure-profiler-running.ts immediately
 * after deployment completes, ensuring profiler starts within seconds.
 *
 * Related Issue: #1027
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
  "continue-on-error"?: boolean;
}

interface WorkflowJob {
  "runs-on": string;
  if?: string;
  steps: WorkflowStep[];
}

interface Workflow {
  name: string;
  jobs: {
    deploy: WorkflowJob;
  };
}

describe("Deploy workflow profiler auto-start", () => {
  const workflowPath = ".github/workflows/deploy.yml";
  let workflow: Workflow;

  it("should load deploy workflow file", () => {
    const content = readFileSync(workflowPath, "utf8");
    workflow = YAML.parse(content) as Workflow;
    expect(workflow).toBeDefined();
  });

  it("should have profiler start step after deployment", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep).toBeDefined();
  });

  it("should run profiler start step only when profiler is enabled", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep?.if).toBeDefined();
    const condition = profilerStep?.if as string;

    // Should check success() and PROFILER_ENABLED value
    expect(condition).toContain("success()");
    expect(condition).toContain("PROFILER_ENABLED");
    expect(condition).toContain("'true'");
  });

  it("should call ensure-profiler-running script", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep?.run).toBeDefined();
    expect(profilerStep?.run).toContain("ensure-profiler-running.ts");
    expect(profilerStep?.run).toContain("npx tsx");
  });

  it("should have required environment variables", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep?.env).toBeDefined();
    expect(profilerStep?.env?.SCREEPS_TOKEN).toBe("${{ secrets.SCREEPS_TOKEN }}");
    expect(profilerStep?.env?.SCREEPS_HOST).toBe("${{ vars.SCREEPS_HOST }}");
    expect(profilerStep?.env?.SCREEPS_SHARD).toBeDefined();
  });

  it("should continue on error to not block deployment", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep?.["continue-on-error"]).toBe(true);
  });

  it("should include warning message on failure", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep?.run).toContain("::warning::");
    expect(profilerStep?.run).toContain("manual start");
  });

  it("should include notice message on start", () => {
    const profilerStep = workflow.jobs.deploy.steps.find(step => step.name === "Start profiler after deployment");

    expect(profilerStep?.run).toContain("::notice::");
    expect(profilerStep?.run).toContain("Starting profiler");
  });

  it("should run after autospawn step", () => {
    const steps = workflow.jobs.deploy.steps;
    const autospawnIndex = steps.findIndex(step => step.id === "autospawn");
    const profilerIndex = steps.findIndex(step => step.name === "Start profiler after deployment");

    expect(autospawnIndex).toBeGreaterThanOrEqual(0);
    expect(profilerIndex).toBeGreaterThan(autospawnIndex);
  });

  it("should run before failure notifications", () => {
    const steps = workflow.jobs.deploy.steps;
    const profilerIndex = steps.findIndex(step => step.name === "Start profiler after deployment");
    const failureNotificationIndex = steps.findIndex(step => step.name === "Notify deployment failure");

    expect(profilerIndex).toBeGreaterThanOrEqual(0);
    expect(failureNotificationIndex).toBeGreaterThan(profilerIndex);
  });
});
