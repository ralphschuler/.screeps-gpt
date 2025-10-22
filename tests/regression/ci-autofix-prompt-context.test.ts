import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Regression test for CI autofix prompt context handling.
 *
 * Addresses issue about handling different workflow trigger contexts
 * (PR-based vs non-PR workflows like post-merge, scheduled, etc.)
 *
 * The prompt should:
 * 1. Provide clear rules for different workflow trigger contexts
 * 2. Define decision logic for commit-to-branch vs create-PR
 * 3. Specify branch handling strategies for different events
 * 4. Include security considerations for protected branches
 *
 * Related Issues:
 * - Issue about enhancing autofix prompt for non-PR workflows
 * - Issue #132 - Comprehensive autofix improvements
 */
describe("CI Autofix Prompt Context Handling", () => {
  const promptPath = resolve(__dirname, "../../.github/copilot/prompts/ci-autofix");

  it("should include rules for PR-triggered workflow failures", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should mention handling pull request context
    expect(promptContent).toMatch(/pull request/i);
  });

  it("should include rules for non-PR workflow failures", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should mention handling main/production branch failures
    expect(promptContent).toMatch(/main|production/i);
  });

  it("should provide decision logic for when to commit directly vs create PR", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should have logic about when to create a new PR
    expect(promptContent).toMatch(/create|open.*pull request|PR/i);

    // Should have logic about when to push directly
    expect(promptContent).toMatch(/push.*directly|commit.*branch/i);
  });

  it("should reference TRIGGER_EVENT variable for context", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should use the TRIGGER_EVENT variable
    expect(promptContent).toMatch(/\$\{TRIGGER_EVENT\}/);
  });

  it("should include branch handling strategies", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should mention different event types
    expect(promptContent).toMatch(/push|schedule|workflow_dispatch/i);
  });

  it("should include security considerations for protected branches", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should mention protected branches or avoiding direct commits to main
    expect(promptContent).toMatch(/protected.*branch|avoid.*direct.*commit.*main/i);
  });

  it("should maintain existing JSON output format requirements", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should have JSON example without markdown fences
    const jsonExampleMatch = promptContent.match(/\{\s*"run_id"[\s\S]*?\}/);
    expect(jsonExampleMatch).toBeDefined();

    // Should explicitly state not to wrap in markdown fences
    expect(promptContent).toMatch(/Do not wrap the JSON in Markdown fences/i);
  });

  it("should have consistent structure with other prompts", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should have MANDATORY ACTIONS section
    expect(promptContent).toMatch(/## MANDATORY ACTIONS/);

    // Should have OUTPUT REQUIREMENTS section
    expect(promptContent).toMatch(/## OUTPUT REQUIREMENTS/);

    // Should have FAILURE HANDLING section
    expect(promptContent).toMatch(/## FAILURE HANDLING/);
  });

  it("should include explicit workflow context decision matrix", () => {
    const promptContent = readFileSync(promptPath, "utf-8");

    // Should have a section or clear guidance about different trigger contexts
    // and how to handle them
    expect(promptContent).toMatch(/workflow.*context|trigger.*context|event.*type/i);
  });
});
