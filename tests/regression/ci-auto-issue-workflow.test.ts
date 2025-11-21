/**
 * Regression test for CI Auto Issue workflow
 *
 * Validates that the CI Auto Issue workflow properly creates issues
 * for failed CI runs and implements circuit breaker pattern.
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

  it("should define check-circuit-breaker job", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    expect(workflow.jobs).toHaveProperty("check-circuit-breaker");
  });

  it("should define circuit breaker outputs", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["check-circuit-breaker"];
    expect(job.outputs).toHaveProperty("should-run");
    expect(job.outputs).toHaveProperty("consecutive-failures");
    expect(job.outputs).toHaveProperty("failure-key");
  });

  it("should check consecutive failures using github-script", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["check-circuit-breaker"];
    const step = job.steps.find((s: { name: string }) => s.name === "Check circuit breaker state");

    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
    expect(step.with.script).toContain("MAX_CONSECUTIVE_FAILURES");
    expect(step.with.script).toContain("BACKOFF_MINUTES");
  });

  it("should define MAX_CONSECUTIVE_FAILURES as 3", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Check that MAX_CONSECUTIVE_FAILURES is set to 3
    expect(content).toContain("const MAX_CONSECUTIVE_FAILURES = 3;");
  });

  it("should define BACKOFF_MINUTES as 15", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Check that BACKOFF_MINUTES is set to 15
    expect(content).toContain("const BACKOFF_MINUTES = 15;");
  });

  it("should have create-issue job dependent on circuit breaker", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const createIssueJob = workflow.jobs["create-issue"];
    expect(createIssueJob.needs).toBe("check-circuit-breaker");
    expect(createIssueJob.if).toContain("needs.check-circuit-breaker.outputs.should-run == 'true'");
  });

  it("should have escalate-to-manual job for circuit breaker trips", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const escalateJob = workflow.jobs["escalate-to-manual"];
    expect(escalateJob).toBeDefined();
    expect(escalateJob.needs).toBe("check-circuit-breaker");
    expect(escalateJob.if).toContain("needs.check-circuit-breaker.outputs.should-run == 'false'");
  });

  it("should create issue when CI fails", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const createIssueJob = workflow.jobs["create-issue"];
    const step = createIssueJob.steps.find((s: { name: string }) => s.name === "Create failure issue");

    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
    expect(step.with.script).toContain("github.rest.issues.create");
  });

  it("should apply appropriate labels to created issues", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify labels are set correctly
    expect(content).toContain("automation");
    expect(content).toContain("ci-failure");
    expect(content).toContain("type/bug");
    expect(content).toContain("priority/high");
  });

  it("should check for existing issues before creating new ones", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify that the issue creation script checks for existing issues
    expect(content).toContain("github.rest.issues.listForRepo");
    expect(content).toContain("existingIssue");
  });

  it("should exclude self-trigger to prevent infinite loops", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["check-circuit-breaker"];
    expect(job.if).toContain("github.event.workflow_run.name != 'CI Auto Issue'");
  });

  it("should query listWorkflowRuns for failure history", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify the circuit breaker queries workflow run history
    expect(content).toContain("github.rest.actions.listWorkflowRuns");
    expect(content).toContain("ci-auto-issue.yml");
  });

  it("should count action_required and failure conclusions", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify that both action_required and failure are counted
    expect(content).toContain("action_required");
    expect(content).toContain("failure");
  });

  it("should reset circuit on success", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify that a success conclusion resets the circuit
    expect(content).toContain("success");
    expect(content).toContain("break");
  });

  it("should get workflow run details", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const createIssueJob = workflow.jobs["create-issue"];
    const step = createIssueJob.steps.find((s: { name: string }) => s.name === "Get workflow run details");

    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
    expect(step.with.script).toContain("github.rest.actions.getWorkflowRun");
    expect(step.with.script).toContain("github.rest.actions.listJobsForWorkflowRun");
  });

  it("should include failed jobs in issue body", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify failed jobs are included in the issue
    expect(content).toContain("Failed Jobs");
    expect(content).toContain("failed_jobs");
  });

  it("should create escalation issue when circuit breaker trips", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const escalateJob = workflow.jobs["escalate-to-manual"];
    const step = escalateJob.steps.find((s: { name: string }) => s.name === "Create escalation issue");

    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
    expect(step.with.script).toContain("github.rest.issues.create");
    expect(step.with.script).toContain("ci-escalation");
  });

  it("should apply critical priority to escalation issues", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify escalation issues get critical priority
    expect(content).toContain("priority/critical");
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
  });

  it("should have appropriate permissions", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    expect(workflow.permissions).toHaveProperty("actions");
    expect(workflow.permissions.actions).toBe("read");
    expect(workflow.permissions).toHaveProperty("issues");
    expect(workflow.permissions.issues).toBe("write");
  });

  it("should send email notification for failures", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const notifyJob = workflow.jobs["notify-failure"];
    expect(notifyJob).toBeDefined();

    const step = notifyJob.steps.find((s: { name: string }) => s.name === "Notify CI failure via email");
    expect(step).toBeDefined();
    expect(step.uses).toContain("send-email-notification");
  });
});
