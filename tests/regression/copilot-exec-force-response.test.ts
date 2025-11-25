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

describe("Copilot-Exec Backward Compatibility", () => {
  const workflowsDir = join(process.cwd(), ".github/workflows");

  // List of workflows that use copilot-exec directly or through specialized agents
  const workflowFiles = [
    { file: "copilot-review.yml", agent: "copilot-audit-agent" },
    { file: "copilot-email-triage.yml", agent: "copilot-exec" },
    { file: "copilot-issue-triage.yml", agent: "copilot-issue-agent" },
    { file: "copilot-todo-pr.yml", agent: "copilot-issue-agent" },
    { file: "copilot-todo-daily.yml", agent: "copilot-exec" }
  ];

  workflowFiles.forEach(({ file: workflowFile, agent }) => {
    it(`should use copilot-exec or specialized agent in ${workflowFile}`, () => {
      const workflowPath = join(workflowsDir, workflowFile);
      const workflowContent = readFileSync(workflowPath, "utf-8");

      // Verify workflow uses either copilot-exec directly or a specialized agent
      // Specialized agents wrap copilot-exec, so force-response is still available
      const usesCopilotExec = workflowContent.includes("uses: ./.github/actions/copilot-exec");
      const usesSpecializedAgent = workflowContent.includes(`uses: ./.github/actions/${agent}`);

      expect(usesCopilotExec || usesSpecializedAgent).toBe(true);
    });
  });
});
