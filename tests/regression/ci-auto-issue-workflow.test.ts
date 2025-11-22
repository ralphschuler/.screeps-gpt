/**
 * Regression test for CI Auto Issue workflow
 *
 * Validates that the CI Auto Issue workflow properly creates issues
 * for failed CI runs on the main branch.
 */

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import yaml from "yaml";

describe("CI Auto Issue Workflow", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/ci-auto-issue.yml");

  it("should have ci-auto-issue.yml workflow file", () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it("should define create-ci-failure-issue job", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    expect(workflow.jobs).toHaveProperty("create-ci-failure-issue");
  });

  it("should only trigger on failed workflow runs", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["create-ci-failure-issue"];
    expect(job.if).toContain("github.event.workflow_run.conclusion == 'failure'");
  });

  it("should only trigger on push to main branch", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["create-ci-failure-issue"];
    expect(job.if).toContain("github.event.workflow_run.event == 'push'");
    expect(job.if).toContain("github.event.workflow_run.head_branch == 'main'");
  });

  it("should list jobs for the failed workflow run", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["create-ci-failure-issue"];
    const step = job.steps.find((s: { name: string }) => s.name === "Create CI failure issue");

    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
    expect(step.with.script).toContain("github.rest.actions.listJobsForWorkflowRun");
  });

  it("should create issue with workflow and job details", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["create-ci-failure-issue"];
    const step = job.steps[0];

    expect(step.with.script).toContain("github.rest.issues.create");
    expect(step.with.script).toContain("CI Error Summary");
    expect(step.with.script).toContain("Failed Jobs");
  });

  it("should apply appropriate labels to created issues", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify labels are set correctly
    expect(content).toContain("automation");
    expect(content).toContain("ci-failure");
    expect(content).toContain("type/bug");
  });



  it("should collect failing steps for error context", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify that failing steps are collected
    expect(content).toContain("failedJobSteps");
    expect(content).toContain("step.conclusion === 'failure'");
  });

  it("should create issue title with error context", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify issue title includes error context
    expect(content).toContain("CI Error:");
    expect(content).toContain("errorContext");
  });

  it("should include failed jobs in issue body", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify failed jobs are included in the issue
    expect(content).toContain("Failed Jobs");
    expect(content).toContain("failedJobNames");
  });

  it("should include workflow metadata in issue body", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify workflow metadata is included
    expect(content).toContain("CI Error Summary");
    expect(content).toContain("run.name");
    expect(content).toContain("run.id");
    expect(content).toContain("run.html_url");
    expect(content).toContain("run.head_branch");
    expect(content).toContain("run.head_sha");
    expect(content).toContain("run.actor.login");
  });

  it("should include first detected error in issue body", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify first detected error is highlighted
    expect(content).toContain("First Detected Error");
    expect(content).toContain("failedJobSteps[0]");
  });

  it("should trigger on workflow_run completion", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    expect(workflow.on).toHaveProperty("workflow_run");
    expect(workflow.on.workflow_run.types).toContain("completed");
  });

  it("should monitor multiple workflows", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const monitoredWorkflows = workflow.on.workflow_run.workflows;

    // Should monitor important workflows
    expect(monitoredWorkflows).toContain("Deploy Screeps AI");
    expect(monitoredWorkflows).toContain("Guard - Build");
    expect(monitoredWorkflows).toContain("Guard - Lint");
    expect(monitoredWorkflows).toContain("Screeps Monitoring");
    expect(monitoredWorkflows).toContain("Post Merge Release");
  });

  it("should have appropriate permissions", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    expect(workflow.permissions).toHaveProperty("actions");
    expect(workflow.permissions.actions).toBe("read");
    expect(workflow.permissions).toHaveProperty("issues");
    expect(workflow.permissions.issues).toBe("write");
  });

  it("should have timeout configured", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["create-ci-failure-issue"];
    expect(job["timeout-minutes"]).toBe(10);
  });

  it("should log created issue URL", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify issue creation is logged
    expect(content).toContain("core.info");
    expect(content).toContain("Created CI error issue");
    expect(content).toContain("issue.html_url");
  });
});
