/**
 * Regression test for documentation workflow configuration (#252)
 *
 * Validates that the GitHub Actions workflow for documentation deployment
 * is properly configured and will execute successfully.
 *
 * Background: The documentation deployment workflow at
 * .github/workflows/docs-pages.yml must be correctly configured to
 * build and deploy documentation to GitHub Pages.
 *
 * Related Issues:
 * - #252: test: implement automated testing for documentation site functionality
 * - #228: fix: resolve documentation workflow husky prepare script failure
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

describe("Documentation workflow configuration (#252)", () => {
  const workflowPath = join(process.cwd(), ".github/workflows/docs-pages.yml");

  it("should have docs-pages.yml workflow file", () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  describe("Workflow structure validation", () => {
    it("should have valid YAML structure", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        name: string;
        on: unknown;
        jobs: Record<string, unknown>;
      };

      expect(workflow).toBeDefined();
      expect(workflow.name).toBe("Publish Documentation Site");
    });

    it("should trigger on main branch pushes", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        on: {
          push?: { branches?: string[] };
          release?: { types?: string[] };
          workflow_dispatch?: Record<string, unknown> | null;
        };
      };

      expect(workflow.on.push?.branches).toContain("main");
    });

    it("should trigger on releases", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        on: {
          release?: { types?: string[] };
        };
      };

      expect(workflow.on.release?.types).toContain("published");
    });

    it("should support manual workflow dispatch", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        on: {
          workflow_dispatch?: Record<string, unknown> | null;
        };
      };

      expect(workflow.on).toHaveProperty("workflow_dispatch");
    });
  });

  describe("Build job validation", () => {
    it("should have build job with correct setup", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        jobs: {
          build?: {
            steps?: Array<{ name?: string; uses?: string; run?: string }>;
          };
        };
      };

      expect(workflow.jobs.build).toBeDefined();
      const steps = workflow.jobs.build?.steps ?? [];
      expect(steps.length).toBeGreaterThan(0);

      // Verify essential steps
      const stepNames = steps.map(s => s.name);
      expect(stepNames).toContain("Checkout");
      expect(stepNames).toContain("Setup Node.js");

      expect(stepNames).toContain("Install documentation dependencies");
      expect(stepNames).toContain("Generate documentation site");
    });

    it("should install documentation dependencies in packages/docs directory", () => {
      const content = readFileSync(workflowPath, "utf-8");

      // Verify working directory is set for packages/docs
      expect(content).toContain("working-directory: packages/docs");
      expect(content).toContain("yarn install");
    });

    it("should generate documentation site", () => {
      const content = readFileSync(workflowPath, "utf-8");

      // Verify documentation build step
      expect(content).toContain("Generate documentation site");
      expect(content).toContain("yarn build");
    });

    it("should copy build output to correct location", () => {
      const content = readFileSync(workflowPath, "utf-8");

      // Verify copy step for GitHub Pages
      expect(content).toContain("Copy to build directory");
      expect(content).toContain("packages/docs/public");
      expect(content).toContain("build/docs-site");
    });

    it("should upload Pages artifact", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        jobs: {
          build?: {
            steps?: Array<{ name?: string; uses?: string; with?: { path?: string } }>;
          };
        };
      };

      const uploadStep = workflow.jobs.build?.steps?.find(s => s.name === "Upload Pages artifact");
      expect(uploadStep).toBeDefined();
      expect(uploadStep?.uses).toContain("upload-pages-artifact");
      expect(uploadStep?.with?.path).toBe("build/docs-site");
    });
  });

  describe("Deploy job validation", () => {
    it("should have deploy job with correct dependencies", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        jobs: {
          deploy?: {
            needs?: string | string[];
          };
        };
      };

      expect(workflow.jobs.deploy).toBeDefined();
      expect(workflow.jobs.deploy?.needs).toBe("build");
    });

    it("should configure GitHub Pages environment", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        jobs: {
          deploy?: {
            environment?: {
              name?: string;
              url?: string;
            };
          };
        };
      };

      expect(workflow.jobs.deploy?.environment?.name).toBe("github-pages");
    });

    it("should use deploy-pages action", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        jobs: {
          deploy?: {
            steps?: Array<{ name?: string; uses?: string }>;
          };
        };
      };

      const deployStep = workflow.jobs.deploy?.steps?.find(s => s.name === "Deploy to GitHub Pages");
      expect(deployStep).toBeDefined();
      expect(deployStep?.uses).toContain("deploy-pages");
    });
  });

  describe("Permissions validation", () => {
    it("should have correct GitHub Pages permissions", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        permissions?: {
          contents?: string;
          pages?: string;
          "id-token"?: string;
        };
      };

      expect(workflow.permissions).toBeDefined();
      expect(workflow.permissions?.contents).toBe("read");
      expect(workflow.permissions?.pages).toBe("write");
      expect(workflow.permissions?.["id-token"]).toBe("write");
    });
  });

  describe("Concurrency validation", () => {
    it("should prevent concurrent documentation deployments", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        concurrency?: {
          group?: string;
          "cancel-in-progress"?: boolean;
        };
      };

      expect(workflow.concurrency).toBeDefined();
      expect(workflow.concurrency?.group).toBe("github-pages");
      expect(workflow.concurrency?.["cancel-in-progress"]).toBe(false);
    });
  });

  describe("Version update integration", () => {
    it("should update versions before building documentation", () => {
      const content = readFileSync(workflowPath, "utf-8");
      const workflow = parse(content) as {
        jobs: {
          build?: {
            steps?: Array<{ name?: string; run?: string }>;
          };
        };
      };

      const versionStep = workflow.jobs.build?.steps?.find(s => s.name === "Update versions");
      expect(versionStep).toBeDefined();
      expect(versionStep?.run).toContain("versions:update");

      // Verify it runs before documentation generation
      const steps = workflow.jobs.build?.steps ?? [];
      const versionIndex = steps.findIndex(s => s.name === "Update versions");
      const buildIndex = steps.findIndex(s => s.name === "Generate documentation site");
      expect(versionIndex).toBeLessThan(buildIndex);
    });
  });
});
