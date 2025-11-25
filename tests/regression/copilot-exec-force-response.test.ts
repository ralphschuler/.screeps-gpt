import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

interface ActionInputs {
  "force-response": {
    description: string;
    required: boolean;
    default: string;
  };
  [key: string]: unknown;
}

interface Action {
  inputs: ActionInputs;
  [key: string]: unknown;
}

describe("Copilot-Exec Force-Response Feature", () => {
  const actionPath = join(process.cwd(), ".github/actions/copilot-exec/action.yml");
  const actionContent = readFileSync(actionPath, "utf-8");
  const action = parse(actionContent) as Action;

  it("should have force-response input parameter", () => {
    // Verify force-response parameter exists in action inputs
    expect(action.inputs).toHaveProperty("force-response");
  });

  it("should have force-response default to false for backward compatibility", () => {
    // Verify backward compatibility - caching enabled by default
    expect(action.inputs["force-response"].default).toBe("false");
  });

  it("should have force-response marked as optional", () => {
    // Verify force-response is not required
    expect(action.inputs["force-response"].required).toBe(false);
  });

  it("should have descriptive documentation for force-response", () => {
    // Verify force-response has clear description
    const description = action.inputs["force-response"].description;
    expect(description).toContain("Skip cache restoration");
    expect(description).toContain("fresh");
  });

  it("should delegate to codex-exec action", () => {
    // Verify copilot-exec now delegates to codex-exec
    expect(actionContent).toContain("uses: ./.github/actions/codex-exec");
  });

  it("should pass force-response parameter to codex-exec", () => {
    // Verify force-response is forwarded to codex-exec
    expect(actionContent).toContain("force-response: ${{ inputs.force-response }}");
  });

  it("should maintain backward compatibility with copilot-token input", () => {
    // Verify copilot-token input is mapped to codex-token
    expect(action.inputs).toHaveProperty("copilot-token");
    expect(actionContent).toContain("codex-token: ${{ inputs.copilot-token }}");
  });
});

describe("Codex-Exec Implementation", () => {
  const codexActionPath = join(process.cwd(), ".github/actions/codex-exec/action.yml");
  const codexActionContent = readFileSync(codexActionPath, "utf-8");
  const codexAction = parse(codexActionContent) as Action;

  it("should have force-response input parameter", () => {
    // Verify force-response parameter exists in codex-exec
    expect(codexAction.inputs).toHaveProperty("force-response");
  });

  it("should conditionally skip cache restoration when force-response is true", () => {
    // Verify cache restoration step has conditional logic
    expect(codexActionContent).toContain("name: Restore result cache");
    expect(codexActionContent).toContain("if: inputs.force-response != 'true'");
  });

  it("should cache fresh responses for future use", () => {
    // Verify execution saves to cache directory
    expect(codexActionContent).toContain(".codex-cache/output.txt");
  });

  it("should use openai/codex-action", () => {
    // Verify codex-exec uses the official OpenAI action
    expect(codexActionContent).toContain("uses: openai/codex-action@v1");
  });
});

describe("Workflow Migration to Codex-Exec", () => {
  const workflowsDir = join(process.cwd(), ".github/workflows");

  // List of workflows that have been migrated to codex-exec
  const workflowFiles = [
    { file: "copilot-review.yml", agent: "copilot-audit-agent" },
    { file: "copilot-email-triage.yml", action: "codex-exec" },
    { file: "copilot-issue-triage.yml", agent: "copilot-issue-agent" },
    { file: "copilot-todo-pr.yml", agent: "copilot-issue-agent" },
    { file: "copilot-todo-daily.yml", action: "codex-exec" },
    { file: "copilot-changelog-to-blog.yml", action: "codex-exec" },
    { file: "copilot-strategic-planner.yml", action: "codex-exec" }
  ];

  workflowFiles.forEach(({ file: workflowFile, agent }) => {
    it(`should use codex-exec or specialized agent in ${workflowFile}`, () => {
      const workflowPath = join(workflowsDir, workflowFile);
      const workflowContent = readFileSync(workflowPath, "utf-8");

      // Verify workflow uses either codex-exec directly or a specialized agent
      // Specialized agents now wrap codex-exec
      const usesCodexExec = workflowContent.includes("uses: ./.github/actions/codex-exec");
      const usesSpecializedAgent = agent && workflowContent.includes(`uses: ./.github/actions/${agent}`);

      expect(usesCodexExec || usesSpecializedAgent).toBe(true);
    });
  });

  it("should use OPENAI_API_KEY in migrated workflows", () => {
    const migratedWorkflows = [
      "copilot-changelog-to-blog.yml",
      "copilot-email-triage.yml",
      "copilot-strategic-planner.yml",
      "copilot-todo-daily.yml"
    ];

    migratedWorkflows.forEach(workflowFile => {
      const workflowPath = join(workflowsDir, workflowFile);
      const workflowContent = readFileSync(workflowPath, "utf-8");

      expect(workflowContent).toContain("codex-token: ${{ secrets.OPENAI_API_KEY }}");
    });
  });
});

describe("Specialized Agents Migration to Codex-Exec", () => {
  const actionsDir = join(process.cwd(), ".github/actions");

  const specializedAgents = [
    "copilot-audit-agent",
    "copilot-dev-agent",
    "copilot-issue-agent",
    "copilot-review-agent",
    "copilot-triage-agent"
  ];

  specializedAgents.forEach(agentName => {
    it(`${agentName} should use codex-exec`, () => {
      const actionPath = join(actionsDir, agentName, "action.yml");
      const actionContent = readFileSync(actionPath, "utf-8");

      expect(actionContent).toContain("uses: ./.github/actions/codex-exec");
    });

    it(`${agentName} should use codex-token parameter`, () => {
      const actionPath = join(actionsDir, agentName, "action.yml");
      const actionContent = readFileSync(actionPath, "utf-8");

      expect(actionContent).toContain("codex-token:");
    });
  });
});
