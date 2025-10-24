/**
 * Regression test for Hexo documentation site build (#252)
 *
 * Ensures that the documentation site builds successfully and generates
 * valid HTML content, preventing blank page issues.
 *
 * Background: The documentation site at https://nyphon.de/.screeps-gpt/
 * previously showed a blank page due to build or rendering issues.
 * These tests validate the build process and generated content.
 *
 * Related Issues:
 * - #252: test: implement automated testing for documentation site functionality
 * - #251: fix: hexo documentation site renders markdown files instead of HTML pages
 * - #228: fix: resolve documentation workflow husky prepare script failure
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const DOCS_BUILD_DIR = join(process.cwd(), "docs-build");
const PUBLIC_DIR = join(DOCS_BUILD_DIR, "public");

describe("Hexo documentation build (#252)", () => {
  beforeAll(() => {
    // Ensure docs-build dependencies are installed
    if (!existsSync(join(DOCS_BUILD_DIR, "node_modules"))) {
      console.log("Installing docs-build dependencies...");
      execSync("npm ci", { cwd: DOCS_BUILD_DIR, stdio: "inherit" });
    }

    // Clean and build documentation
    console.log("Building documentation site...");
    execSync("npm run clean", { cwd: DOCS_BUILD_DIR, stdio: "inherit" });
    execSync("npm run build", { cwd: DOCS_BUILD_DIR, stdio: "inherit" });
  }, 300000); // 5 minutes timeout for build operations

  describe("Build process validation", () => {
    it("should have valid Hexo configuration file", () => {
      const configPath = join(DOCS_BUILD_DIR, "_config.yml");
      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, "utf-8");
      expect(configContent).toContain("title:");
      expect(configContent).toContain("theme:");
      expect(configContent).toContain("url:");
    });

    it("should have documentation source files", () => {
      const sourceDir = join(DOCS_BUILD_DIR, "source");
      expect(existsSync(sourceDir)).toBe(true);

      const indexFile = join(sourceDir, "index.md");
      expect(existsSync(indexFile)).toBe(true);
    });

    it("should build successfully and generate public directory", () => {
      expect(existsSync(PUBLIC_DIR)).toBe(true);
    });
  });

  describe("Generated content validation", () => {
    it("should generate index.html with actual content", () => {
      const indexPath = join(PUBLIC_DIR, "index.html");
      expect(existsSync(indexPath)).toBe(true);

      const content = readFileSync(indexPath, "utf-8");

      // Verify HTML structure
      expect(content).toContain("<!doctype html>");
      expect(content).toContain("<html");
      expect(content).toContain("</html>");
      expect(content).toContain("<head>");
      expect(content).toContain("</head>");
      expect(content).toContain("<body>");
      expect(content).toContain("</body>");

      // Verify content is not blank (has more than just boilerplate)
      expect(content.length).toBeGreaterThan(500);

      // Verify site title is present
      expect(content).toContain("Screeps GPT");
    });

    it("should generate CSS files", () => {
      const cssDir = join(PUBLIC_DIR, "css");
      expect(existsSync(cssDir)).toBe(true);

      const stylePath = join(cssDir, "style.css");
      expect(existsSync(stylePath)).toBe(true);

      const cssContent = readFileSync(stylePath, "utf-8");
      expect(cssContent.length).toBeGreaterThan(0);
    });

    it("should generate documentation pages", () => {
      const docsDir = join(PUBLIC_DIR, "docs");
      expect(existsSync(docsDir)).toBe(true);

      // Check for key documentation pages
      const pages = ["getting-started.html", "index.html", "automation/overview.html", "changelog/versions.html"];

      for (const page of pages) {
        const pagePath = join(docsDir, page);
        expect(existsSync(pagePath), `Expected ${page} to exist`).toBe(true);

        const content = readFileSync(pagePath, "utf-8");
        expect(content).toContain("<!doctype html>");
        expect(content.length).toBeGreaterThan(100);
      }
    });

    it("should generate valid HTML files without markdown artifacts", () => {
      const indexPath = join(PUBLIC_DIR, "index.html");
      const content = readFileSync(indexPath, "utf-8");

      // Verify no raw markdown syntax is present
      expect(content).not.toMatch(/^#{1,6}\s+/m); // No markdown headers
      expect(content).not.toMatch(/^\*\s+/m); // No unordered list markers
      expect(content).not.toMatch(/^\d+\.\s+/m); // No ordered list markers
      expect(content).not.toContain("```"); // No code fence markers

      // Verify proper HTML rendering
      expect(content).toMatch(/<h[1-6]>/); // Should have HTML headers
    });

    it("should include proper meta tags", () => {
      const indexPath = join(PUBLIC_DIR, "index.html");
      const content = readFileSync(indexPath, "utf-8");

      // Verify essential meta tags
      expect(content).toContain('<meta charset="utf-8"');
      expect(content).toContain('<meta name="viewport"');
      expect(content).toContain('<meta name="description"');

      // Verify site-specific content
      expect(content).toContain("autonomous");
      expect(content).toContain("Screeps");
    });

    it("should generate search.xml for site search", () => {
      const searchPath = join(PUBLIC_DIR, "search.xml");
      expect(existsSync(searchPath)).toBe(true);

      const content = readFileSync(searchPath, "utf-8");
      expect(content).toContain("<?xml");
      expect(content.length).toBeGreaterThan(100);
    });

    it("should generate atom.xml for RSS feed", () => {
      const atomPath = join(PUBLIC_DIR, "atom.xml");
      expect(existsSync(atomPath)).toBe(true);

      const content = readFileSync(atomPath, "utf-8");
      expect(content).toContain("<?xml");
      expect(content).toContain("feed");
      expect(content).toContain("Screeps GPT");
    });
  });

  describe("Navigation and structure validation", () => {
    it("should have navigation links in index page", () => {
      const indexPath = join(PUBLIC_DIR, "index.html");
      const content = readFileSync(indexPath, "utf-8");

      // Verify navigation structure exists
      expect(content).toContain("<nav");
      expect(content).toContain("<a ");
    });

    it("should have proper URL structure with base path", () => {
      const indexPath = join(PUBLIC_DIR, "index.html");
      const content = readFileSync(indexPath, "utf-8");

      // Verify base path is correctly set
      expect(content).toContain("/.screeps-gpt/");
    });

    it("should generate archives structure", () => {
      const archivesDir = join(PUBLIC_DIR, "archives");
      expect(existsSync(archivesDir)).toBe(true);

      const archiveIndexPath = join(archivesDir, "index.html");
      expect(existsSync(archiveIndexPath)).toBe(true);
    });

    it("should generate changelog directory", () => {
      const changelogDir = join(PUBLIC_DIR, "changelog");
      expect(existsSync(changelogDir)).toBe(true);

      const changelogIndexPath = join(changelogDir, "index.html");
      expect(existsSync(changelogIndexPath)).toBe(true);
    });
  });

  describe("Configuration validation", () => {
    it("should have valid package.json with Hexo dependencies", () => {
      const packagePath = join(DOCS_BUILD_DIR, "package.json");
      expect(existsSync(packagePath)).toBe(true);

      const pkg = JSON.parse(readFileSync(packagePath, "utf-8")) as {
        dependencies: Record<string, string>;
        scripts: Record<string, string>;
      };

      // Verify Hexo core is present
      expect(pkg.dependencies).toHaveProperty("hexo");

      // Verify essential Hexo plugins
      expect(pkg.dependencies).toHaveProperty("hexo-renderer-marked");
      expect(pkg.dependencies).toHaveProperty("hexo-renderer-ejs");
      expect(pkg.dependencies).toHaveProperty("hexo-generator-index");

      // Verify build scripts
      expect(pkg.scripts).toHaveProperty("build");
      expect(pkg.scripts.build).toContain("hexo generate");
    });

    it("should have theme directory", () => {
      const themesDir = join(DOCS_BUILD_DIR, "themes");
      expect(existsSync(themesDir)).toBe(true);
    });
  });
});
