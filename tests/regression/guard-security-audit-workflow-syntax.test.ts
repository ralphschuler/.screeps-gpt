import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";

describe("Security Audit workflow syntax", () => {
  const workflowPath = join(process.cwd(), ".github/workflows/guard-security-audit.yml");

  it("should have valid YAML syntax", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(() => yaml.parse(content)).not.toThrow();
  });

  it("should not use problematic multi-line jq commands with trailing backslashes", () => {
    const content = readFileSync(workflowPath, "utf8");

    // The problematic pattern was:
    // jq -r \
    //   '.metadata.vulnerabilities | to_entries | \
    //   map(...) | join(...)')
    // This fails because the backslash before the pipe in the jq expression
    // causes shell parsing errors

    // Check that we don't have the broken pattern:
    // A backslash at end of line, followed by a jq filter starting with
    // a pipe character at the start of the next line
    const brokenPattern = /jq[^|]*\\\s*\n\s*'[^']*\|[^']*\\\s*\n/;
    expect(content).not.toMatch(brokenPattern);
  });

  it("should properly parse audit results in the Run npm audit step", () => {
    const content = readFileSync(workflowPath, "utf8");
    const parsed = yaml.parse(content) as {
      jobs: {
        audit: {
          steps: Array<{
            name?: string;
            id?: string;
            run?: string;
          }>;
        };
      };
    };

    const auditStep = parsed.jobs.audit.steps.find(step => step.id === "audit");
    expect(auditStep).toBeDefined();
    expect(auditStep?.run).toBeDefined();

    const runScript = auditStep?.run || "";

    // Verify jq commands are present
    expect(runScript).toContain("jq -r");
    expect(runScript).toContain(".metadata.vulnerabilities");
    expect(runScript).toContain("to_entries");

    // Verify error handling is present
    expect(runScript).toContain("JQ_EXIT_CODE");
    expect(runScript).toContain('VULNERABILITIES="parsing_error"');
    expect(runScript).toContain('TOTAL="unknown"');
  });

  it("should handle jq parsing failures gracefully", () => {
    const content = readFileSync(workflowPath, "utf8");
    const parsed = yaml.parse(content) as {
      jobs: {
        audit: {
          steps: Array<{
            name?: string;
            id?: string;
            run?: string;
          }>;
        };
      };
    };

    const auditStep = parsed.jobs.audit.steps.find(step => step.id === "audit");
    const runScript = auditStep?.run || "";

    // Verify error handling for jq failures
    expect(runScript).toContain("if [ $JQ_EXIT_CODE -ne 0 ]");
    expect(runScript).toContain("::error::Failed to parse audit results with jq");

    // Verify handling of unknown total
    expect(runScript).toContain('if [ "$TOTAL" = "unknown" ]');
    expect(runScript).toContain("::error::Unable to determine");
  });

  it("should output required values to GITHUB_OUTPUT", () => {
    const content = readFileSync(workflowPath, "utf8");
    const parsed = yaml.parse(content) as {
      jobs: {
        audit: {
          steps: Array<{
            name?: string;
            id?: string;
            run?: string;
          }>;
        };
      };
    };

    const auditStep = parsed.jobs.audit.steps.find(step => step.id === "audit");
    const runScript = auditStep?.run || "";

    // Verify outputs are set
    expect(runScript).toContain("vulnerabilities=$VULNERABILITIES");
    expect(runScript).toContain("total=$TOTAL");
    expect(runScript).toContain("exit_code=$AUDIT_EXIT_CODE");
    expect(runScript).toContain("GITHUB_OUTPUT");
  });
});
