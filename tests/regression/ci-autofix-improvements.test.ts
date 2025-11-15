import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve, join } from "path";
import { parse } from "yaml";

interface WorkflowStep {
  name: string;
  uses?: string;
  with?: {
    timeout?: string;
    verbose?: string;
    "force-response"?: boolean;
  };
}

interface WorkflowJob {
  steps: WorkflowStep[];
}

interface Workflow {
  jobs: {
    autofix: WorkflowJob;
  };
}

interface AgentAction {
  inputs: {
    timeout?: {
      default?: string;
    };
    verbose?: {
      default?: string;
    };
  };
}

/**
 * Regression test for CI autofix workflow improvements.
 *
 * Validates enhancements from issue #132:
 * - Enhanced failure detection and classification
 * - Improved error context gathering
 * - Specialized fix strategies for different failure types
 * - Integration improvements (timeout, verbose logging)
 * - Comprehensive documentation
 *
 * Related Issues:
 * - Issue #132 - Review and improve copilot-ci-autofix workflow effectiveness
 */
describe("CI Autofix Workflow Improvements", () => {
  const promptPath = resolve(__dirname, "../../.github/copilot/prompts/ci-autofix");
  const workflowPath = resolve(__dirname, "../../.github/workflows/copilot-ci-autofix.yml");
  const docsPath = resolve(__dirname, "../../packages/docs/docs/automation/overview.md");

  describe("Enhanced Failure Classification", () => {
    it("should include comprehensive failure type categories", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have dedicated section for failure classification
      expect(promptContent).toMatch(/## FAILURE CLASSIFICATION & DETECTION/);

      // Should categorize automatic fix types
      expect(promptContent).toMatch(/Linting Failures/i);
      expect(promptContent).toMatch(/Formatting Failures/i);
      expect(promptContent).toMatch(/Compilation Errors/i);
      expect(promptContent).toMatch(/Dependency Conflicts/i);
      expect(promptContent).toMatch(/Documentation Failures/i);
      expect(promptContent).toMatch(/Version Index Sync/i);
    });

    it("should define manual review categories", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should categorize manual review requirements
      expect(promptContent).toMatch(/Manual Review Required/i);
      expect(promptContent).toMatch(/Test Failures/i);
      expect(promptContent).toMatch(/Security Issues/i);
      expect(promptContent).toMatch(/Performance Issues/i);
      expect(promptContent).toMatch(/Workflow Configuration/i);
    });

    it("should include detection patterns for each failure type", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should provide detection guidance
      expect(promptContent).toMatch(/Detection:/);
      expect(promptContent).toMatch(/Fix Strategy:/);
      expect(promptContent).toMatch(/eslint|yamllint/i);
      expect(promptContent).toMatch(/prettier/i);
    });
  });

  describe("Improved Error Context Gathering", () => {
    it("should include comprehensive context gathering section", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have dedicated section
      expect(promptContent).toMatch(/## ERROR CONTEXT GATHERING/);
    });

    it("should specify downloading full logs", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should mention gh run download
      expect(promptContent).toMatch(/gh run download.*\$\{RUN_ID\}/);
    });

    it("should extract error indicators with context", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should search for error patterns
      expect(promptContent).toMatch(/Error:|Failed:|FAILED/);
      expect(promptContent).toMatch(/lines.*before.*after/i);
    });

    it("should identify affected files", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should mention file paths and line numbers
      expect(promptContent).toMatch(/file paths.*line numbers/i);
      expect(promptContent).toMatch(/git diff/i);
    });

    it("should check for related failures", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should query recent workflow runs
      expect(promptContent).toMatch(/gh run list/);
      expect(promptContent).toMatch(/recent.*workflow.*runs/i);
    });
  });

  describe("Specialized Fix Strategies", () => {
    it("should include execution playbook with phases", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have structured playbook
      expect(promptContent).toMatch(/## EXECUTION PLAYBOOK/);
      expect(promptContent).toMatch(/Phase 1:/);
      expect(promptContent).toMatch(/Phase 2:/);
      expect(promptContent).toMatch(/Phase 3:/);
    });

    it("should provide linting fix strategy", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have specific commands for linting
      expect(promptContent).toMatch(/For Linting Failures:/);
      expect(promptContent).toMatch(/bun run lint:fix/);
      expect(promptContent).toMatch(/bun run lint/); // validation
    });

    it("should provide formatting fix strategy", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have specific commands for formatting
      expect(promptContent).toMatch(/For Formatting Failures:/);
      expect(promptContent).toMatch(/bun run format:write/);
      expect(promptContent).toMatch(/bun run format:check/); // validation
    });

    it("should provide version sync fix strategy", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have specific commands for version sync
      expect(promptContent).toMatch(/For Version Index Sync:/);
      expect(promptContent).toMatch(/bun run versions:update/);
    });

    it("should provide dependency fix strategy", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have specific commands for dependencies
      expect(promptContent).toMatch(/For Dependency Conflicts:/);
      expect(promptContent).toMatch(/bun install/);
    });

    it("should provide documentation fix strategy", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should mention documentation fixes
      expect(promptContent).toMatch(/For Documentation Failures:/);
      expect(promptContent).toMatch(/broken links.*examples/i);
    });

    it("should include validation steps for each fix type", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should mention validation/verification
      expect(promptContent).toMatch(/Verify fix resolved/i);
      expect(promptContent).toMatch(/Phase 4:.*Validation/);
    });
  });

  describe("Workflow Integration Improvements", () => {
    it("should configure extended timeout", () => {
      const workflowContent = readFileSync(workflowPath, "utf-8");
      const workflow = parse(workflowContent) as Workflow;

      // Should have timeout configured either in workflow or via specialized agent
      const autofixStep = workflow.jobs.autofix.steps.find(
        (step: WorkflowStep) => step.name === "Run Copilot CI auto-fix"
      );

      // Check if using specialized agent (copilot-ci-autofix-agent)
      const usesSpecializedAgent = autofixStep?.uses?.includes("copilot-ci-autofix-agent");

      if (usesSpecializedAgent) {
        // Specialized agent has timeout default of "45" in its action.yml
        const agentPath = join(process.cwd(), ".github/actions/copilot-ci-autofix-agent/action.yml");
        const agentContent = readFileSync(agentPath, "utf-8");
        const agentAction = parse(agentContent) as AgentAction;
        expect(agentAction.inputs.timeout?.default).toBe("45");
      } else {
        // Direct copilot-exec usage should specify timeout
        expect(autofixStep?.with?.timeout).toBe("45");
      }
    });

    it("should enable verbose logging", () => {
      const workflowContent = readFileSync(workflowPath, "utf-8");
      const workflow = parse(workflowContent) as Workflow;

      // Should have verbose enabled either in workflow or via specialized agent
      const autofixStep = workflow.jobs.autofix.steps.find(
        (step: WorkflowStep) => step.name === "Run Copilot CI auto-fix"
      );

      // Check if using specialized agent (copilot-ci-autofix-agent)
      const usesSpecializedAgent = autofixStep?.uses?.includes("copilot-ci-autofix-agent");

      if (usesSpecializedAgent) {
        // Specialized agent has verbose default of "true" in its action.yml
        const agentPath = join(process.cwd(), ".github/actions/copilot-ci-autofix-agent/action.yml");
        const agentContent = readFileSync(agentPath, "utf-8");
        const agentAction = parse(agentContent) as AgentAction;
        expect(agentAction.inputs.verbose?.default).toBe("true");
      } else {
        // Direct copilot-exec usage should specify verbose
        expect(autofixStep?.with?.verbose).toBe("true");
      }
    });

    it("should maintain force-response for time-sensitive data", () => {
      const workflowContent = readFileSync(workflowPath, "utf-8");
      const workflow = parse(workflowContent) as Workflow;

      // Should have force-response enabled either in workflow or via specialized agent
      const autofixStep = workflow.jobs.autofix.steps.find(
        (step: WorkflowStep) => step.name === "Run Copilot CI auto-fix"
      );

      // Check if using specialized agent (copilot-ci-autofix-agent)
      const usesSpecializedAgent = autofixStep?.uses?.includes("copilot-ci-autofix-agent");

      if (usesSpecializedAgent) {
        // Specialized agent sets force-response: true internally in its action.yml
        const agentPath = join(process.cwd(), ".github/actions/copilot-ci-autofix-agent/action.yml");
        const agentContent = readFileSync(agentPath, "utf-8");
        // Verify agent passes force-response: true to copilot-exec
        expect(agentContent).toContain("force-response: true");
      } else {
        // Direct copilot-exec usage should specify force-response
        expect(autofixStep?.with?.["force-response"]).toBe(true);
      }
    });
  });

  describe("Enhanced Output Format", () => {
    it("should include failure_type in JSON output", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have failure_type field with enumeration of types
      expect(promptContent).toMatch(/"failure_type":/);
      expect(promptContent).toContain("linting");
      expect(promptContent).toContain("formatting");
      expect(promptContent).toContain("dependency");
      expect(promptContent).toContain("documentation");
    });

    it("should include fix_strategy in JSON output", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have fix_strategy field with options
      expect(promptContent).toMatch(/"fix_strategy":/);
      expect(promptContent).toContain("direct_push");
      expect(promptContent).toContain("create_pr");
    });

    it("should include validation_commands in JSON output", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have validation_commands field
      expect(promptContent).toMatch(/"validation_commands":/);
      expect(promptContent).toMatch(/bun run lint.*bun run test:unit/);
    });

    it("should include files_changed in JSON output", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have files_changed field
      expect(promptContent).toMatch(/"files_changed":/);
    });

    it("should maintain workflow field in JSON output", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have workflow field for tracking
      expect(promptContent).toMatch(/"workflow":/);
    });
  });

  describe("Documentation Updates", () => {
    it("should document enhanced failure classification", () => {
      const docsContent = readFileSync(docsPath, "utf-8");

      // Should mention failure classification
      expect(docsContent).toMatch(/Enhanced Failure Classification/i);
      expect(docsContent).toMatch(/categorizes failures/i);
    });

    it("should document improved error context gathering", () => {
      const docsContent = readFileSync(docsPath, "utf-8");

      // Should mention error context
      expect(docsContent).toMatch(/Improved Error Context Gathering/i);
      expect(docsContent).toMatch(/Downloads full logs/i);
    });

    it("should document specialized fix strategies", () => {
      const docsContent = readFileSync(docsPath, "utf-8");

      // Should list fix strategies
      expect(docsContent).toMatch(/Specialized Fix Strategies/i);
      expect(docsContent).toMatch(/Linting Failures/);
      expect(docsContent).toMatch(/Formatting Failures/);
      expect(docsContent).toMatch(/Version Index Sync/);
    });

    it("should document manual review escalation", () => {
      const docsContent = readFileSync(docsPath, "utf-8");

      // Should mention manual review
      expect(docsContent).toMatch(/Manual Review Escalation/i);
      expect(docsContent).toMatch(/automatically create issues/i);
      expect(docsContent).toMatch(/help-wanted.*state\/pending/);
    });

    it("should document output metrics", () => {
      const docsContent = readFileSync(docsPath, "utf-8");

      // Should mention output metrics
      expect(docsContent).toMatch(/Output Metrics/i);
      expect(docsContent).toMatch(/failure_type.*fix_strategy/);
    });

    it("should document timeout and verbose logging", () => {
      const docsContent = readFileSync(docsPath, "utf-8");

      // Should mention timeout and logging
      expect(docsContent).toMatch(/Timeout & Logging/i);
      expect(docsContent).toMatch(/45-minute timeout/);
      expect(docsContent).toMatch(/verbose logging/);
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain existing MANDATORY ACTIONS section", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should preserve existing structure
      expect(promptContent).toMatch(/## MANDATORY ACTIONS/);
      expect(promptContent).toMatch(/MUST authenticate GitHub CLI/);
      expect(promptContent).toMatch(/MUST analyze failure root cause/);
    });

    it("should maintain existing OUTPUT REQUIREMENTS section", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should preserve output requirements
      expect(promptContent).toMatch(/## OUTPUT REQUIREMENTS/);
      expect(promptContent).toMatch(/minimal and targeted/i);
    });

    it("should maintain WORKFLOW CONTEXT & BRANCH STRATEGY", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should preserve branch strategy
      expect(promptContent).toMatch(/## WORKFLOW CONTEXT & BRANCH STRATEGY/);
      expect(promptContent).toMatch(/Decision Matrix for Fix Application/);
      expect(promptContent).toMatch(/Protected Branch Security/);
    });

    it("should maintain JSON output format requirements", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should preserve JSON formatting rules
      expect(promptContent).toMatch(/Do not wrap the JSON in Markdown fences/i);
      expect(promptContent).toMatch(/Use empty arrays\/nulls when appropriate/);
    });
  });

  describe("Safety and Quality Controls", () => {
    it("should include explicit fix appropriateness criteria", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have clear criteria
      expect(promptContent).toMatch(/## FIX APPROPRIATENESS CRITERIA/);
      expect(promptContent).toMatch(/Only attempt automatic fixes for:/);
      expect(promptContent).toMatch(/Do NOT attempt automatic fixes for:/);
    });

    it("should require changelog updates for bug fixes", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should mention changelog
      expect(promptContent).toMatch(/Changelog/i);
      expect(promptContent).toMatch(/CHANGELOG\.md/);
    });

    it("should require validation before committing", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should have validation phase
      expect(promptContent).toMatch(/Phase 4:.*Validation/);
      expect(promptContent).toMatch(/Validate Fix/);
      expect(promptContent).toMatch(/Run the command that originally failed/);
    });

    it("should prevent risky fixes with escalation", () => {
      const promptContent = readFileSync(promptPath, "utf-8");

      // Should mention creating issues for complex cases
      expect(promptContent).toMatch(/IF failure classification unclear/i);
      expect(promptContent).toMatch(/Default to creating issue rather than attempting risky fix/i);
    });
  });
});
