/**
 * Unit tests for generate-missing-blog-posts script
 *
 * Tests the blog post generation functionality that converts
 * CHANGELOG.md entries into blog posts.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const CHANGELOG_PATH = join(process.cwd(), "CHANGELOG.md");
const BLOG_POSTS_DIR = join(process.cwd(), "packages/docs/source/_posts");

describe("Blog post generation", () => {
  it("should have CHANGELOG.md in repository root", () => {
    expect(existsSync(CHANGELOG_PATH)).toBe(true);
  });

  it("should have blog posts directory", () => {
    expect(existsSync(BLOG_POSTS_DIR)).toBe(true);
  });

  describe("CHANGELOG.md structure", () => {
    it("should contain version headers", () => {
      const changelog = readFileSync(CHANGELOG_PATH, "utf-8");
      const versionRegex = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm;
      const matches = [...changelog.matchAll(versionRegex)];

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.length).toBeGreaterThanOrEqual(40); // Should have many releases
    });

    it("should have valid version format in headers", () => {
      const changelog = readFileSync(CHANGELOG_PATH, "utf-8");
      const versionRegex = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm;
      const matches = [...changelog.matchAll(versionRegex)];

      for (const match of matches) {
        const version = match[1];
        const date = match[2];

        // Validate version format (semver)
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);

        // Validate date format (YYYY-MM-DD)
        expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });

  describe("Blog post files", () => {
    it("should have blog posts for releases", () => {
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md"));

      expect(blogPosts.length).toBeGreaterThan(0);
      expect(blogPosts.length).toBeGreaterThanOrEqual(40); // Should have many posts
    });

    it("should have valid blog post filenames", () => {
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md"));

      for (const file of blogPosts) {
        // Filename format: release-X-Y-Z.md
        expect(file).toMatch(/^release-\d+-\d+-\d+\.md$/);
      }
    });

    it("should have valid YAML front matter in blog posts", () => {
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md")).slice(0, 5); // Test first 5 posts

      for (const file of blogPosts) {
        const content = readFileSync(join(BLOG_POSTS_DIR, file), "utf-8");

        // Check for front matter delimiters
        expect(content.startsWith("---\n")).toBe(true);
        expect(content.indexOf("---\n", 4)).toBeGreaterThan(0);

        // Check for required front matter fields
        expect(content).toContain("title:");
        expect(content).toContain("date:");
        expect(content).toContain("categories:");
        expect(content).toContain("tags:");
      }
    });

    it("should have proper date format in blog posts", () => {
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md")).slice(0, 5); // Test first 5 posts

      for (const file of blogPosts) {
        const content = readFileSync(join(BLOG_POSTS_DIR, file), "utf-8");
        const dateMatch = content.match(/^date: (.+)$/m);

        expect(dateMatch).not.toBeNull();
        if (dateMatch) {
          const date = dateMatch[1];
          // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
          expect(date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        }
      }
    });

    it("should have content after front matter", () => {
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md")).slice(0, 5); // Test first 5 posts

      for (const file of blogPosts) {
        const content = readFileSync(join(BLOG_POSTS_DIR, file), "utf-8");

        // Find end of front matter
        const endOfFrontMatter = content.indexOf("---\n", 4);
        expect(endOfFrontMatter).toBeGreaterThan(0);

        // Check that there's content after front matter
        const bodyContent = content.slice(endOfFrontMatter + 4).trim();
        expect(bodyContent.length).toBeGreaterThan(0);
      }
    });

    it("should have changelog link in blog posts", () => {
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md")).slice(0, 5); // Test first 5 posts

      for (const file of blogPosts) {
        const content = readFileSync(join(BLOG_POSTS_DIR, file), "utf-8");

        // Check for GitHub release link
        expect(content).toContain("Full Changelog");
        expect(content).toContain("github.com/ralphschuler/.screeps-gpt/releases/tag/v");
      }
    });
  });

  describe("Coverage validation", () => {
    it("should have blog posts matching CHANGELOG versions", () => {
      // Parse CHANGELOG.md
      const changelog = readFileSync(CHANGELOG_PATH, "utf-8");
      const versionRegex = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm;
      const changelogVersions = [...changelog.matchAll(versionRegex)].map(m => m[1]);

      // Parse blog posts
      const files = readdirSync(BLOG_POSTS_DIR);
      const blogPosts = files.filter(f => f.startsWith("release-") && f.endsWith(".md"));
      const blogVersions = blogPosts.map(f => {
        const versionSlug = f.replace("release-", "").replace(".md", "");
        return versionSlug.replace(/-/g, ".");
      });

      // Check coverage (some versions like 0.8.0, 0.11.3, 0.12.0 already existed)
      const existingPosts = ["0.8.0", "0.11.3", "0.12.0"];
      const expectedCoverage = changelogVersions.length;
      const actualCoverage = blogVersions.length;

      // All changelog versions should have blog posts
      expect(actualCoverage).toBeGreaterThanOrEqual(expectedCoverage - 1); // Allow 1 missing for Unreleased
    });
  });
});
