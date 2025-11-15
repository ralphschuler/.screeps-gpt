/**
 * Unit tests for Hexo documentation build script (#252)
 *
 * Validates the build-hexo-site.ts script that generates the documentation site.
 *
 * Background: The build script is responsible for initializing Hexo,
 * loading plugins, and generating the static site. These tests ensure
 * the script is properly configured.
 *
 * Related Issues:
 * - #252: test: implement automated testing for documentation site functionality
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("Hexo build script validation (#252)", () => {
  const scriptPath = join(process.cwd(), "packages/utilities/scripts/build-hexo-site.ts");

  it("should have build-hexo-site.ts script", () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  describe("Script structure", () => {
    it("should import Hexo library", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain('import Hexo from "hexo"');
    });

    it("should have buildHexoSite function", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("buildHexoSite");
      expect(content).toContain("async function buildHexoSite");
    });

    it("should initialize Hexo instance", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("new Hexo");
      expect(content).toContain("hexo.init()");
    });

    it("should load Hexo configuration and plugins", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("hexo.load()");
    });

    it("should clean previous build", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain('hexo.call("clean")');
    });

    it("should generate static site", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain('hexo.call("generate"');
      expect(content).toContain("force: true");
    });

    it("should copy output to build directory", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("build/docs-site");
      expect(content).toContain("cp(");
      expect(content).toContain("recursive: true");
    });

    it("should exit Hexo instance on completion", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("hexo.exit()");
    });
  });

  describe("Plugin loading", () => {
    it("should load required Hexo renderers", () => {
      const content = readFileSync(scriptPath, "utf-8");

      const requiredRenderers = ["hexo-renderer-ejs", "hexo-renderer-marked", "hexo-renderer-stylus"];

      for (const renderer of requiredRenderers) {
        expect(content).toContain(renderer);
      }
    });

    it("should load required Hexo generators", () => {
      const content = readFileSync(scriptPath, "utf-8");

      const requiredGenerators = [
        "hexo-generator-index",
        "hexo-generator-archive",
        "hexo-generator-category",
        "hexo-generator-tag"
      ];

      for (const generator of requiredGenerators) {
        expect(content).toContain(generator);
      }
    });

    it("should handle plugin loading errors gracefully", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("catch");
      expect(content).toContain("console.warn");
    });
  });

  describe("Error handling", () => {
    it("should have try-catch block for build process", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("try {");
      expect(content).toContain("} catch");
      expect(content).toContain("console.error");
    });

    it("should ensure cleanup with finally block", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("} finally {");
      expect(content).toContain("hexo.exit()");
    });

    it("should set error exit code on failure", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("process.exitCode");
    });
  });

  describe("Configuration and debugging", () => {
    it("should provide debug information during build", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("console.log");
      expect(content).toContain("Theme:");
      expect(content).toContain("Renderers:");
      expect(content).toContain("Generators:");
    });

    it("should use correct directory paths", () => {
      const content = readFileSync(scriptPath, "utf-8");
      expect(content).toContain("source_dir");
      expect(content).toContain("public_dir");
    });
  });

  describe("Main documentation configuration", () => {
    const configPath = join(process.cwd(), "packages/docs/_config.yml");

    it("should have _config.yml in packages/docs", () => {
      expect(existsSync(configPath)).toBe(true);
    });

    it("should have site title configured", () => {
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("title: Screeps GPT");
    });

    it("should have GitHub Pages URL configured", () => {
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("url:");
      expect(content).toContain("ralphschuler.github.io");
      expect(content).toContain("root: /.screeps-gpt/");
    });

    it("should have theme configured", () => {
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("theme:");
    });

    it("should have required plugins configured", () => {
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("hexo-renderer-marked");
      expect(content).toContain("hexo-generator-index");
    });

    it("should enable search functionality", () => {
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("search:");
      expect(content).toContain("hexo-generator-search");
    });

    it("should enable RSS feed", () => {
      const content = readFileSync(configPath, "utf-8");
      expect(content).toContain("feed:");
      expect(content).toContain("hexo-generator-feed");
    });
  });

  describe("Package.json script integration", () => {
    const packagePath = join(process.cwd(), "package.json");

    it("should have build:docs-site script", () => {
      const content = readFileSync(packagePath, "utf-8");
      const pkg = JSON.parse(content) as { scripts: Record<string, string> };

      expect(pkg.scripts["build:docs-site"]).toBeDefined();
      expect(pkg.scripts["build:docs-site"]).toContain("build-hexo-site.ts");
    });

    it("should use tsx for script execution", () => {
      const content = readFileSync(packagePath, "utf-8");
      const pkg = JSON.parse(content) as { scripts: Record<string, string> };

      expect(pkg.scripts["build:docs-site"]).toContain("tsx");
    });
  });
});
