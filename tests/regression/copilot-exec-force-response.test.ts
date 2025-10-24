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

  it("should conditionally skip cache restoration when force-response is true", () => {
    // Verify cache restoration step has conditional logic
    expect(actionContent).toContain("name: Restore result cache");
    expect(actionContent).toContain("if: inputs.force-response != 'true'");
  });

  it("should maintain cache-result step id for backward compatibility", () => {
    // Verify step id is preserved for existing workflows
    expect(actionContent).toMatch(/id:\s+cache-result/);
  });

  it("should preserve existing cache key structure", () => {
    // Verify cache key format unchanged
    expect(actionContent).toContain(
      "key: copilot-result-${{ steps.render.outputs.prompt-sha }}-${{ steps.resolve-model.outputs.model }}-${{ runner.os }}"
    );
  });

  it("should still allow cached output to be used when cache hits", () => {
    // Verify short-circuit logic still references cache-result
    expect(actionContent).toContain("if: steps.cache-result.outputs.cache-hit == 'true'");
  });

  it("should still cache fresh responses for future use", () => {
    // Verify copilot execution still saves to cache directory
    expect(actionContent).toContain(".copilot-cache/output.txt");
    expect(actionContent).toContain("tee .copilot-cache/output.txt");
  });

  it("should preserve verbose logging for cache status", () => {
    // Verify verbose logging step still exists
    expect(actionContent).toContain("name: Log cache status");
    expect(actionContent).toContain("CACHE_HIT:");
  });
});

describe("Copilot-Exec Backward Compatibility", () => {
  const workflowsDir = join(process.cwd(), ".github/workflows");

  // List of workflows that use copilot-exec
  const workflowFiles = [
    "copilot-review.yml",
    "copilot-email-triage.yml",
    "copilot-issue-triage.yml",
    "copilot-todo-pr.yml",
    "screeps-stats-monitor.yml",
    "copilot-todo-daily.yml",
    "copilot-autonomous-monitor.yml",
    "copilot-speckit.yml",
    "copilot-ci-autofix.yml"
  ];

  workflowFiles.forEach(workflowFile => {
    it(`should not require force-response parameter in ${workflowFile}`, () => {
      const workflowPath = join(workflowsDir, workflowFile);
      const workflowContent = readFileSync(workflowPath, "utf-8");

      // Verify workflow can still work without force-response parameter
      // (this is implicit - if the workflow uses copilot-exec without the parameter,
      // it will use the default value of false)
      expect(workflowContent).toContain("uses: ./.github/actions/copilot-exec");
    });
  });
});
