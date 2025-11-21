import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("GitHub Packages Configuration", () => {
  const packageJsonPath = resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  it("should have screeps_bot flag set to true", () => {
    expect(packageJson.screeps_bot).toBe(true);
  });

  it("should have main field pointing to dist/main.js", () => {
    expect(packageJson.main).toBe("dist/main.js");
  });

  it("should have scoped package name for GitHub Packages", () => {
    expect(packageJson.name).toMatch(/^@\w+\/screeps-gpt$/);
    expect(packageJson.name).toBe("@ralphschuler/screeps-gpt");
  });

  it("should have publishConfig pointing to GitHub Packages registry", () => {
    expect(packageJson.publishConfig).toBeDefined();
    expect(packageJson.publishConfig.registry).toBe("https://npm.pkg.github.com");
  });

  it("should have repository field configured", () => {
    expect(packageJson.repository).toBeDefined();
    expect(packageJson.repository.type).toBe("git");
    expect(packageJson.repository.url).toContain("github.com/ralphschuler/.screeps-gpt");
  });

  it("should include dist/main.js in files field", () => {
    expect(packageJson.files).toBeDefined();
    expect(packageJson.files).toContain("dist/main.js");
    expect(packageJson.files).toContain("dist/main.js.map");
    expect(packageJson.files).toContain("README.md");
    expect(packageJson.files).toContain("LICENSE");
  });

  it("should have prepublishOnly script to build before publishing", () => {
    expect(packageJson.scripts.prepublishOnly).toBeDefined();
    expect(packageJson.scripts.prepublishOnly).toContain("build");
  });

  it("should have private field set to true (workspace package)", () => {
    // Package is set to private as it's a workspace root with subpackages
    // Individual packages can still be published from packages/*/
    expect(packageJson.private).toBe(true);
  });
});
