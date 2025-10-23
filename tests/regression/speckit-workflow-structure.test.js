import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

describe("Spec-Kit Workflow Structure", () => {
  const workflowPath = join(process.cwd(), ".github/workflows/copilot-speckit.yml");
  const workflowContent = readFileSync(workflowPath, "utf-8");
  const workflow = parse(workflowContent);

  it("should have correct workflow name", () => {
    expect(workflow.name).toBe("Copilot Spec-Kit");
  });

  it("should trigger on issues labeled and issue_comment created events", () => {
    expect(workflow.on).toHaveProperty("issues");
    expect(workflow.on.issues.types).toContain("labeled");
    expect(workflow.on).toHaveProperty("issue_comment");
    expect(workflow.on.issue_comment.types).toContain("created");
  });

  it("should have minimal permissions (contents read, issues write)", () => {
    expect(workflow.permissions).toEqual({
      contents: "read",
      issues: "write"
    });
  });

  it("should have generate-plan job for speckit label", () => {
    expect(workflow.jobs).toHaveProperty("generate-plan");
    const job = workflow.jobs["generate-plan"];

    // Check conditional execution
    expect(job.if).toContain("github.event_name == 'issues'");
    expect(job.if).toContain("github.event.label.name == 'speckit'");

    // Check job uses copilot-exec action
    const copilotStep = job.steps.find(step => step.uses === "./.github/actions/copilot-exec");
    expect(copilotStep).toBeDefined();
    expect(copilotStep.with["prompt-path"]).toBe(".github/copilot/prompts/speckit-plan");
  });

  it("should have refine-plan job for @speckit comments", () => {
    expect(workflow.jobs).toHaveProperty("refine-plan");
    const job = workflow.jobs["refine-plan"];

    // Check conditional execution
    expect(job.if).toContain("github.event_name == 'issue_comment'");
    expect(job.if).toContain("startsWith(github.event.comment.body, '@speckit')");

    // Check job uses copilot-exec action
    const copilotStep = job.steps.find(step => step.uses === "./.github/actions/copilot-exec");
    expect(copilotStep).toBeDefined();
    expect(copilotStep.with["prompt-path"]).toBe(".github/copilot/prompts/speckit-refine");
  });

  it("should pass correct environment variables to generate-plan", () => {
    const job = workflow.jobs["generate-plan"];
    const copilotStep = job.steps.find(step => step.uses === "./.github/actions/copilot-exec");

    expect(copilotStep.env).toHaveProperty("REPO_NAME");
    expect(copilotStep.env).toHaveProperty("ISSUE_NUMBER");
    expect(copilotStep.env).toHaveProperty("ISSUE_TITLE");
    expect(copilotStep.env).toHaveProperty("ISSUE_BODY");
    expect(copilotStep.env).toHaveProperty("ISSUE_HTML_URL");
    expect(copilotStep.env).toHaveProperty("ISSUE_AUTHOR");
  });

  it("should pass correct environment variables to refine-plan", () => {
    const job = workflow.jobs["refine-plan"];
    const copilotStep = job.steps.find(step => step.uses === "./.github/actions/copilot-exec");

    expect(copilotStep.env).toHaveProperty("REPO_NAME");
    expect(copilotStep.env).toHaveProperty("ISSUE_NUMBER");
    expect(copilotStep.env).toHaveProperty("ISSUE_TITLE");
    expect(copilotStep.env).toHaveProperty("ISSUE_HTML_URL");
    expect(copilotStep.env).toHaveProperty("COMMENT_BODY");
    expect(copilotStep.env).toHaveProperty("COMMENT_AUTHOR");
  });

  it("should use COPILOT_TOKEN secret", () => {
    const jobs = Object.values(workflow.jobs);
    jobs.forEach(job => {
      const copilotStep = job.steps.find(step => step.uses === "./.github/actions/copilot-exec");
      if (copilotStep) {
        expect(copilotStep.with["copilot-token"]).toBe("${{ secrets.COPILOT_TOKEN }}");
      }
    });
  });
});

describe("Spec-Kit Prompt Templates", () => {
  it("should have speckit-plan prompt template", () => {
    const promptPath = join(process.cwd(), ".github/copilot/prompts/speckit-plan");
    const promptContent = readFileSync(promptPath, "utf-8");

    expect(promptContent).toContain("Spec-Kit Plan Generation");
    expect(promptContent).toContain("MANDATORY ACTIONS");
    expect(promptContent).toContain("PLAN STRUCTURE REQUIREMENTS");
    expect(promptContent).toContain("Problem Statement");
    expect(promptContent).toContain("Solution Overview");
    expect(promptContent).toContain("Implementation Steps");
    expect(promptContent).toContain("Acceptance Criteria");
  });

  it("should have speckit-refine prompt template", () => {
    const promptPath = join(process.cwd(), ".github/copilot/prompts/speckit-refine");
    const promptContent = readFileSync(promptPath, "utf-8");

    expect(promptContent).toContain("Spec-Kit Plan Refinement");
    expect(promptContent).toContain("MANDATORY ACTIONS");
    expect(promptContent).toContain("REFINEMENT GUIDELINES");
    expect(promptContent).toContain("@speckit finalize");
    expect(promptContent).toContain("Todo");
  });
});

describe("Spec-Kit Label Configuration", () => {
  it("should have speckit label defined in labels.yml", () => {
    const labelsPath = join(process.cwd(), ".github/labels.yml");
    const labelsContent = readFileSync(labelsPath, "utf-8");

    expect(labelsContent).toContain("name: speckit");
    expect(labelsContent).toContain("Triggers spec-kit workflow");
  });
});
