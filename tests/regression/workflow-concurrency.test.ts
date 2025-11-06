import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";

describe("Workflow concurrency controls", () => {
  const workflowsDir = join(process.cwd(), ".github/workflows");
  const workflowFiles = readdirSync(workflowsDir).filter(file => file.endsWith(".yml") || file.endsWith(".yaml"));

  // All workflows should have concurrency controls
  const expectedWorkflows = [
    // Guard workflows
    "guard-build.yml",
    "guard-coverage.yml",
    "guard-format.yml",
    "guard-lint.yml",
    "guard-test-docs.yml",
    "guard-test-e2e.yml",
    "guard-test-regression.yml",
    "guard-test-unit.yml",
    "guard-version.yml",
    "guard-yaml-lint.yml",
    // Copilot automation workflows
    "copilot-ci-autofix.yml",
    "copilot-email-triage.yml",
    "copilot-issue-triage.yml",
    "copilot-review.yml",
    "copilot-speckit.yml",
    "copilot-todo-daily.yml",
    "copilot-todo-pr.yml",
    // Monitoring workflows
    "screeps-monitoring.yml",
    "screeps-spawn-monitor.yml",
    // Singleton workflows
    "dependabot-automerge.yml",
    "label-sync.yml",
    // Other workflows that already had concurrency
    "deploy.yml",
    "docs-pages.yml",
    "post-merge-release.yml"
  ];

  for (const workflowFile of expectedWorkflows) {
    it(`${workflowFile} should define concurrency controls`, () => {
      const workflowPath = join(workflowsDir, workflowFile);
      const content = readFileSync(workflowPath, "utf8");
      const parsed = yaml.parse(content) as {
        concurrency?: {
          group?: string;
          "cancel-in-progress"?: boolean;
        };
      };

      // Verify concurrency section exists
      expect(parsed.concurrency).toBeDefined();
      expect(parsed.concurrency?.group).toBeDefined();

      // Verify cancel-in-progress is explicitly set (true or false)
      expect(parsed.concurrency).toHaveProperty("cancel-in-progress");
      expect(typeof parsed.concurrency?.["cancel-in-progress"]).toBe("boolean");
    });
  }

  describe("Guard workflows", () => {
    const guardWorkflows = [
      "guard-build.yml",
      "guard-coverage.yml",
      "guard-format.yml",
      "guard-lint.yml",
      "guard-test-docs.yml",
      "guard-test-e2e.yml",
      "guard-test-regression.yml",
      "guard-test-unit.yml",
      "guard-version.yml",
      "guard-yaml-lint.yml"
    ];

    for (const workflowFile of guardWorkflows) {
      it(`${workflowFile} should use per-workflow-ref concurrency with cancellation`, () => {
        const workflowPath = join(workflowsDir, workflowFile);
        const content = readFileSync(workflowPath, "utf8");
        const parsed = yaml.parse(content) as {
          concurrency: {
            group: string;
            "cancel-in-progress": boolean;
          };
        };

        // Guard workflows should cancel in progress
        expect(parsed.concurrency["cancel-in-progress"]).toBe(true);

        // Guard workflows should use workflow+ref based grouping
        expect(parsed.concurrency.group).toContain("github.workflow");
        expect(parsed.concurrency.group).toContain("github.ref");
      });
    }
  });

  describe("Copilot issue-triggered workflows", () => {
    it("copilot-todo-pr.yml should use per-issue concurrency without cancellation", () => {
      const workflowPath = join(workflowsDir, "copilot-todo-pr.yml");
      const content = readFileSync(workflowPath, "utf8");
      const parsed = yaml.parse(content) as {
        concurrency: {
          group: string;
          "cancel-in-progress": boolean;
        };
      };

      // Should not cancel in progress (let agent complete work)
      expect(parsed.concurrency["cancel-in-progress"]).toBe(false);

      // Should use issue number for grouping
      expect(parsed.concurrency.group).toContain("github.event.issue.number");
    });
  });

  describe("Copilot workflow-triggered workflows", () => {
    it("copilot-ci-autofix.yml should use per-workflow-run concurrency without cancellation", () => {
      const workflowPath = join(workflowsDir, "copilot-ci-autofix.yml");
      const content = readFileSync(workflowPath, "utf8");
      const parsed = yaml.parse(content) as {
        concurrency: {
          group: string;
          "cancel-in-progress": boolean;
        };
      };

      // Should not cancel in progress
      expect(parsed.concurrency["cancel-in-progress"]).toBe(false);

      // Should use workflow run ID for grouping
      expect(parsed.concurrency.group).toContain("github.event.workflow_run.id");
    });
  });

  describe("Monitoring workflows", () => {
    const monitoringWorkflows = ["screeps-monitoring.yml", "screeps-spawn-monitor.yml"];

    for (const workflowFile of monitoringWorkflows) {
      it(`${workflowFile} should prevent overlapping runs without cancellation`, () => {
        const workflowPath = join(workflowsDir, workflowFile);
        const content = readFileSync(workflowPath, "utf8");
        const parsed = yaml.parse(content) as {
          concurrency: {
            group: string;
            "cancel-in-progress": boolean;
          };
        };

        // Should not cancel in progress (let monitoring complete)
        expect(parsed.concurrency["cancel-in-progress"]).toBe(false);

        // Should use workflow-level grouping to prevent overlaps
        expect(parsed.concurrency.group).toContain("github.workflow");
      });
    }
  });

  describe("Singleton workflows", () => {
    const singletonWorkflows = ["label-sync.yml", "dependabot-automerge.yml"];

    for (const workflowFile of singletonWorkflows) {
      it(`${workflowFile} should use workflow-level concurrency with cancellation`, () => {
        const workflowPath = join(workflowsDir, workflowFile);
        const content = readFileSync(workflowPath, "utf8");
        const parsed = yaml.parse(content) as {
          concurrency: {
            group: string;
            "cancel-in-progress": boolean;
          };
        };

        // Should cancel in progress (only one instance needed)
        expect(parsed.concurrency["cancel-in-progress"]).toBe(true);

        // Should use workflow-level grouping
        expect(parsed.concurrency.group).toContain("github.workflow");
      });
    }
  });

  it("should have all workflow files covered in expected list", () => {
    // Verify we're not missing any workflows in our test coverage
    const testedWorkflows = new Set(expectedWorkflows);
    const actualWorkflows = workflowFiles;

    for (const workflow of actualWorkflows) {
      expect(testedWorkflows.has(workflow)).toBe(true);
    }
  });
});
