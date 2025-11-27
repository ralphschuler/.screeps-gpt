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

  it("should use GitHub Copilot CLI for execution", () => {
    // Verify copilot-exec uses @github/copilot CLI
    expect(actionContent).toContain("npm install -g @github/copilot");
  });

  it("should conditionally skip cache restoration when force-response is true", () => {
    // Verify cache restoration step has conditional logic
    expect(actionContent).toContain("name: Restore result cache");
    expect(actionContent).toContain("if: inputs.force-response != 'true'");
  });

  it("should have copilot-token input parameter", () => {
    // Verify copilot-token input exists
    expect(action.inputs).toHaveProperty("copilot-token");
  });
});

describe("Copilot-Exec Implementation", () => {
  const copilotActionPath = join(process.cwd(), ".github/actions/copilot-exec/action.yml");
  const copilotActionContent = readFileSync(copilotActionPath, "utf-8");
  const copilotAction = parse(copilotActionContent) as Action;

  it("should have force-response input parameter", () => {
    // Verify force-response parameter exists in copilot-exec
    expect(copilotAction.inputs).toHaveProperty("force-response");
  });

  it("should conditionally skip cache restoration when force-response is true", () => {
    // Verify cache restoration step has conditional logic
    expect(copilotActionContent).toContain("name: Restore result cache");
    expect(copilotActionContent).toContain("if: inputs.force-response != 'true'");
  });

  it("should cache fresh responses for future use", () => {
    // Verify execution saves to cache directory
    expect(copilotActionContent).toContain(".copilot-cache/output.txt");
  });

  it("should use GitHub Copilot CLI", () => {
    // Verify copilot-exec uses the GitHub Copilot CLI
    expect(copilotActionContent).toContain("npm install -g @github/copilot");
    expect(copilotActionContent).toContain("copilot -p");
  });
});

describe("Workflow Migration to Copilot-Exec", () => {
  const workflowsDir = join(process.cwd(), ".github/workflows");

  // List of workflows that use copilot-exec or specialized agents
  const workflowFiles = [
    { file: "copilot-review.yml", agent: "copilot-audit-agent" },
    { file: "copilot-email-triage.yml", action: "copilot-exec" },
    { file: "copilot-issue-triage.yml", agent: "copilot-issue-agent" },
    { file: "copilot-todo-pr.yml", agent: "copilot-issue-agent" },
    { file: "copilot-todo-daily.yml", action: "copilot-exec" },
    { file: "copilot-changelog-to-blog.yml", action: "copilot-exec" },
    { file: "copilot-strategic-planner.yml", action: "copilot-exec" }
  ];

  workflowFiles.forEach(({ file: workflowFile, agent, action: _action }) => {
    it(`should use copilot-exec or specialized agent in ${workflowFile}`, () => {
      const workflowPath = join(workflowsDir, workflowFile);
      const workflowContent = readFileSync(workflowPath, "utf-8");

      // Verify workflow uses either copilot-exec directly or a specialized agent
      // Specialized agents wrap copilot-exec
      const usesCopilotExec = workflowContent.includes("uses: ./.github/actions/copilot-exec");
      const usesSpecializedAgent = agent && workflowContent.includes(`uses: ./.github/actions/${agent}`);

      expect(usesCopilotExec || usesSpecializedAgent).toBe(true);
    });
  });

  it("should use COPILOT_TOKEN in workflows", () => {
    const workflowsWithCopilotToken = [
      "copilot-changelog-to-blog.yml",
      "copilot-email-triage.yml",
      "copilot-strategic-planner.yml",
      "copilot-todo-daily.yml"
    ];

    workflowsWithCopilotToken.forEach(workflowFile => {
      const workflowPath = join(workflowsDir, workflowFile);
      const workflowContent = readFileSync(workflowPath, "utf-8");

      expect(workflowContent).toContain("copilot-token: ${{ secrets.COPILOT_TOKEN }}");
    });
  });
});

describe("Specialized Agents Using Copilot-Exec", () => {
  const actionsDir = join(process.cwd(), ".github/actions");

  const specializedAgents = [
    "copilot-audit-agent",
    "copilot-dev-agent",
    "copilot-issue-agent",
    "copilot-review-agent",
    "copilot-triage-agent"
  ];

  specializedAgents.forEach(agentName => {
    it(`${agentName} should use copilot-exec`, () => {
      const actionPath = join(actionsDir, agentName, "action.yml");
      const actionContent = readFileSync(actionPath, "utf-8");

      expect(actionContent).toContain("uses: ./.github/actions/copilot-exec");
    });

    it(`${agentName} should use copilot-token parameter`, () => {
      const actionPath = join(actionsDir, agentName, "action.yml");
      const actionContent = readFileSync(actionPath, "utf-8");

      expect(actionContent).toContain("copilot-token:");
    });
  });
});
