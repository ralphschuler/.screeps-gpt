import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import { execSync } from "child_process";
import { writeFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";

describe("Screeps monitoring workflow shell syntax", () => {
  const workflowPath = join(process.cwd(), ".github/workflows/screeps-monitoring.yml");

  it("should have valid YAML syntax", () => {
    const content = readFileSync(workflowPath, "utf8");
    expect(() => yaml.parse(content)).not.toThrow();
  });

  it("should have valid shell syntax in commit step", () => {
    const content = readFileSync(workflowPath, "utf8");
    const parsed = yaml.parse(content) as {
      jobs: {
        monitor: {
          steps: Array<{
            name: string;
            run?: string;
          }>;
        };
      };
    };

    // Find the commit step
    const commitStep = parsed.jobs.monitor.steps.find(
      step => step.name === "Commit bot snapshots and health state"
    );

    expect(commitStep).toBeDefined();
    expect(commitStep?.run).toBeDefined();

    // Extract and validate shell script
    const shellScript = commitStep!.run!;

    // Create a temporary file to validate the shell syntax
    const tempDir = mkdtempSync(join(tmpdir(), "shell-test-"));
    const scriptPath = join(tempDir, "test-script.sh");
    writeFileSync(scriptPath, `#!/bin/bash\n${shellScript}`);

    // Validate shell syntax using bash -n
    expect(() => {
      execSync(`bash -n ${scriptPath}`, { encoding: "utf8" });
    }).not.toThrow();
  });

  it("should not have orphaned else statements", () => {
    const content = readFileSync(workflowPath, "utf8");
    const parsed = yaml.parse(content) as {
      jobs: {
        monitor: {
          steps: Array<{
            name: string;
            run?: string;
          }>;
        };
      };
    };

    // Find the commit step
    const commitStep = parsed.jobs.monitor.steps.find(
      step => step.name === "Commit bot snapshots and health state"
    );

    expect(commitStep).toBeDefined();
    expect(commitStep?.run).toBeDefined();

    const shellScript = commitStep!.run!;
    const lines = shellScript.split("\n");

    // Check for orphaned else statements
    // An orphaned else would be an else with no corresponding if before it
    let ifDepth = 0;
    let inIfBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Count if statements
      if (line.match(/^\s*if\s+/)) {
        ifDepth++;
        inIfBlock = true;
      }
      
      // Check for fi (closing if)
      if (line.match(/^\s*fi\s*$/)) {
        ifDepth--;
        if (ifDepth < 0) {
          throw new Error(`Line ${i + 1}: Unmatched 'fi' statement`);
        }
      }
      
      // Check for else statements
      if (line.match(/^\s*else\s*$/)) {
        if (ifDepth === 0) {
          throw new Error(
            `Line ${i + 1}: Orphaned 'else' statement without corresponding 'if'`
          );
        }
      }
    }

    // All if statements should be closed
    expect(ifDepth).toBe(0);
  });

  it("should properly structure conditional blocks", () => {
    const content = readFileSync(workflowPath, "utf8");
    const parsed = yaml.parse(content) as {
      jobs: {
        monitor: {
          steps: Array<{
            name: string;
            run?: string;
          }>;
        };
      };
    };

    const commitStep = parsed.jobs.monitor.steps.find(
      step => step.name === "Commit bot snapshots and health state"
    );

    const shellScript = commitStep!.run!;
    
    // Verify the script has the expected structure
    expect(shellScript).toContain("git config user.name");
    expect(shellScript).toContain("if [ -d \"reports/bot-snapshots\" ]");
    expect(shellScript).toContain("if git diff --cached --quiet");
    
    // Should have proper if-else-fi structure
    const ifCount = (shellScript.match(/\bif\s+/g) || []).length;
    const fiCount = (shellScript.match(/\bfi\b/g) || []).length;
    
    expect(ifCount).toBeGreaterThan(0);
    expect(ifCount).toBe(fiCount);
  });
});
