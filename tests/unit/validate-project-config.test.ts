import { describe, it, expect } from "vitest";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";

describe("Project configuration validator script", () => {
  const scriptPath = resolve("scripts", "validate-project-config.ts");

  it("should exist and be readable", async () => {
    await expect(access(scriptPath)).resolves.toBeUndefined();
  });

  it("should have correct shebang for tsx", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toMatch(/^#!\/usr\/bin\/env tsx/);
  });

  it("should import from child_process for Node compatibility", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain('import { spawnSync } from "child_process"');
  });

  it("should have main validation function", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("function main()");
    expect(content).toContain("main();");
  });

  it("should check for GitHub CLI", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("function checkGitHubCLI()");
    expect(content).toContain('"gh", ["--version"]');
  });

  it("should check for GitHub token", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("function checkGitHubToken()");
    expect(content).toContain("GITHUB_TOKEN");
  });

  it("should validate project access via GraphQL", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("function validateProjectAccess");
    expect(content).toContain("projectV2");
    expect(content).toContain('"api", "graphql"');
  });

  it("should list projects for owner", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("function listProjects");
    expect(content).toContain('"project", "list"');
  });

  it("should support command line arguments", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("function parseArgs()");
    expect(content).toContain("--project-number");
    expect(content).toContain("--project-owner");
  });

  it("should provide troubleshooting guidance", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("Troubleshooting");
    expect(content).toContain("docs/automation/github-projects-setup.md");
  });

  it("should handle missing configuration gracefully", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("Project configuration incomplete");
    expect(content).toContain("PROJECT_NUMBER");
    expect(content).toContain("PROJECT_OWNER");
  });

  it("should have proper TypeScript types", async () => {
    const content = await readFile(scriptPath, "utf-8");
    expect(content).toContain("interface ValidationResult");
    expect(content).toContain("interface ProjectInfo");
  });
});
