/**
 * Regression test for CI autofix circuit breaker
 *
 * Validates that the circuit breaker prevents infinite retry loops
 * when the autofix workflow encounters persistent failures.
 *
 * Issue: https://github.com/ralphschuler/.screeps-gpt/issues/XXX
 */

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import yaml from "yaml";

describe("CI Autofix Circuit Breaker", () => {
  const workflowPath = path.join(process.cwd(), ".github/workflows/copilot-ci-autofix.yml");

  it("should have copilot-ci-autofix.yml workflow file", () => {
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

  it("should have autofix job dependent on circuit breaker", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const autofixJob = workflow.jobs.autofix;
    expect(autofixJob.needs).toBe("check-circuit-breaker");
    expect(autofixJob.if).toContain("needs.check-circuit-breaker.outputs.should-run == 'true'");
  });

  it("should have escalate-to-manual job for circuit breaker trips", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const escalateJob = workflow.jobs["escalate-to-manual"];
    expect(escalateJob).toBeDefined();
    expect(escalateJob.needs).toBe("check-circuit-breaker");
    expect(escalateJob.if).toContain("needs.check-circuit-breaker.outputs.should-run == 'false'");
  });

  it("should create issue when circuit breaker trips", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const escalateJob = workflow.jobs["escalate-to-manual"];
    const step = escalateJob.steps.find((s: { name: string }) => s.name === "Create manual review issue");

    expect(step).toBeDefined();
    expect(step.uses).toContain("actions/github-script");
    expect(step.with.script).toContain("github.rest.issues.create");
    expect(step.with.script).toContain("ci-autofix-escalation");
  });

  it("should have appropriate permissions for issue creation", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const escalateJob = workflow.jobs["escalate-to-manual"];
    expect(escalateJob.permissions).toHaveProperty("issues");
    expect(escalateJob.permissions.issues).toBe("write");
  });

  it("should log circuit breaker status in autofix job", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const autofixJob = workflow.jobs.autofix;
    const step = autofixJob.steps.find((s: { name: string }) => s.name === "Log circuit breaker status");

    expect(step).toBeDefined();
    expect(step.run).toContain("CI Autofix Attempt");
    expect(step.run).toContain("Consecutive failures");
  });

  it("should check for existing issues before creating new ones", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify that the escalation script checks for existing issues
    expect(content).toContain("github.rest.issues.listForRepo");
    expect(content).toContain("existingIssue");
  });

  it("should exclude self-trigger to prevent infinite loops", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");
    const workflow = yaml.parse(content);

    const job = workflow.jobs["check-circuit-breaker"];
    expect(job.if).toContain("github.event.workflow_run.name != 'Copilot CI AutoFix'");
  });

  it("should query listWorkflowRuns for failure history", () => {
    const content = fs.readFileSync(workflowPath, "utf-8");

    // Verify the circuit breaker queries workflow run history
    expect(content).toContain("github.rest.actions.listWorkflowRuns");
    expect(content).toContain("copilot-ci-autofix.yml");
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
});
