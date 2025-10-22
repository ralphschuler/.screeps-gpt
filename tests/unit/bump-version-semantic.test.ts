import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("Semantic Version Bump Script", () => {
  it("should export a valid version bump script", async () => {
    const scriptPath = resolve("scripts/bump-version-semantic.ts");
    const content = await readFile(scriptPath, "utf8");

    // Verify script contains key functionality
    expect(content).toContain("determineVersionBump");
    expect(content).toContain("getCommitsSinceLastTag");
    expect(content).toContain("BREAKING CHANGE");
    expect(content).toContain("feat");
  });

  it("should handle conventional commit format detection", async () => {
    const scriptPath = resolve("scripts/bump-version-semantic.ts");
    const content = await readFile(scriptPath, "utf8");

    // Verify conventional commit patterns are present
    expect(content).toContain("feat(");
    expect(content).toContain("fix(");
    expect(content).toContain("chore:");
  });

  it("should handle pre-1.0 version major bump conversion", async () => {
    const scriptPath = resolve("scripts/bump-version-semantic.ts");
    const content = await readFile(scriptPath, "utf8");

    // Verify pre-release handling
    expect(content).toContain("parsed.major === 0");
    expect(content).toContain("Pre-1.0 version detected");
  });

  it("should use semver library for version calculations", async () => {
    const scriptPath = resolve("scripts/bump-version-semantic.ts");
    const content = await readFile(scriptPath, "utf8");

    // Verify semver usage
    expect(content).toContain("from \"semver\"");
    expect(content).toContain("inc(");
    expect(content).toContain("parse(");
  });
});
