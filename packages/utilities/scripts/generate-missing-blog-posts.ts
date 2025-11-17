#!/usr/bin/env tsx

/**
 * Generate missing blog posts from CHANGELOG.md entries
 *
 * This script:
 * 1. Parses CHANGELOG.md to extract all release versions
 * 2. Checks which blog posts already exist
 * 3. Generates blog posts for missing releases
 * 4. Saves them to packages/docs/source/_posts/
 */

import fs from "node:fs";
import path from "node:path";

// Types
interface Release {
  version: string;
  date: string;
  content: string;
}

interface BlogPost {
  title: string;
  date: string;
  categories: string[];
  tags: string[];
  content: string;
}

// Constants
const REPO_ROOT = path.resolve(process.cwd());
const CHANGELOG_PATH = path.join(REPO_ROOT, "CHANGELOG.md");
const BLOG_POSTS_DIR = path.join(REPO_ROOT, "packages/docs/source/_posts");

/**
 * Parse CHANGELOG.md and extract all releases
 */
function parseChangelog(): Release[] {
  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf-8");
  const releases: Release[] = [];

  // Split by version headers
  const versionRegex = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm;
  let match: RegExpExecArray | null;
  const matches: Array<{ version: string; date: string; index: number }> = [];

  while ((match = versionRegex.exec(changelog)) !== null) {
    matches.push({
      version: match[1],
      date: match[2],
      index: match.index
    });
  }

  // Extract content for each version
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const startIndex = current.index;
    const endIndex = next ? next.index : changelog.length;
    const content = changelog.slice(startIndex, endIndex).trim();

    releases.push({
      version: current.version,
      date: current.date,
      content
    });
  }

  return releases;
}

/**
 * Check which blog posts already exist
 */
function getExistingBlogPosts(): Set<string> {
  const existing = new Set<string>();

  if (!fs.existsSync(BLOG_POSTS_DIR)) {
    return existing;
  }

  const files = fs.readdirSync(BLOG_POSTS_DIR);
  for (const file of files) {
    if (file.startsWith("release-") && file.endsWith(".md")) {
      // Extract version from filename: release-0-12-0.md -> 0.12.0
      const versionSlug = file.replace("release-", "").replace(".md", "");
      const version = versionSlug.replace(/-/g, ".");
      existing.add(version);
    }
  }

  return existing;
}

/**
 * Generate a blog post from a changelog entry
 */
function generateBlogPost(release: Release): BlogPost {
  // Parse changelog content to extract categories
  const { version, date, content } = release;

  // Extract sections from changelog
  const lines = content.split("\n");
  const sections: { [key: string]: string[] } = {};
  let currentSection = "";

  for (const line of lines) {
    if (line.startsWith("### ")) {
      currentSection = line.replace("### ", "").trim();
      sections[currentSection] = [];
    } else if (currentSection && line.trim()) {
      sections[currentSection].push(line);
    }
  }

  // Determine categories and tags based on content
  const categories = ["Release Notes"];
  const tags = ["release"];

  // Add categories based on sections
  if (sections["Added"]) categories.push("Features");
  if (sections["Fixed"]) categories.push("Bug Fixes");
  if (sections["Changed"]) categories.push("Improvements");
  if (sections["Security"]) categories.push("Security");

  // Extract tags from content keywords
  const contentLower = content.toLowerCase();
  const tagKeywords = {
    automation: ["automation", "workflow", "ci/cd", "github actions"],
    documentation: ["documentation", "docs", "readme"],
    testing: ["test", "testing", "coverage", "e2e"],
    performance: ["performance", "optimization", "cpu", "memory"],
    monitoring: ["monitoring", "metrics", "alerts"],
    deployment: ["deployment", "deploy", "release"],
    security: ["security", "vulnerability", "audit"]
  };

  for (const [tag, keywords] of Object.entries(tagKeywords)) {
    if (keywords.some(keyword => contentLower.includes(keyword))) {
      tags.push(tag);
    }
  }

  // Generate blog title
  let title = `Release ${version}`;

  // Extract main feature from first Added item if available
  if (sections["Added"]?.length > 0) {
    const firstFeature = sections["Added"][0]
      .replace(/^- \*\*/, "")
      .replace(/\*\*.*$/, "")
      .replace(/\(#\d+\)/, "")
      .trim();
    if (firstFeature && firstFeature.length < 80) {
      title = `Release ${version}: ${firstFeature}`;
    }
  }

  // Generate blog content
  const blogContent = generateBlogContent(release, sections);

  return {
    title,
    date: `${date}T00:00:00.000Z`,
    categories,
    tags,
    content: blogContent
  };
}

/**
 * Generate the main content of the blog post
 */
function generateBlogContent(release: Release, sections: { [key: string]: string[] }): string {
  const { version } = release;
  let content = "";

  // Introduction
  content += `We're pleased to announce version ${version} of the Screeps GPT autonomous bot.\n\n`;

  // Overview of changes
  const sectionCount = Object.keys(sections).length;
  if (sectionCount > 0) {
    content += "## What's New\n\n";
  }

  // Added section
  if (sections["Added"]) {
    content += "### New Features\n\n";
    content += sections["Added"].join("\n") + "\n\n";
  }

  // Changed section
  if (sections["Changed"]) {
    content += "### Improvements\n\n";
    content += sections["Changed"].join("\n") + "\n\n";
  }

  // Fixed section
  if (sections["Fixed"]) {
    content += "### Bug Fixes\n\n";
    content += sections["Fixed"].join("\n") + "\n\n";
  }

  // Security section
  if (sections["Security"]) {
    content += "### Security\n\n";
    content += sections["Security"].join("\n") + "\n\n";
  }

  // Deprecated section
  if (sections["Deprecated"]) {
    content += "### Deprecated\n\n";
    content += sections["Deprecated"].join("\n") + "\n\n";
  }

  // Removed section
  if (sections["Removed"]) {
    content += "### Removed\n\n";
    content += sections["Removed"].join("\n") + "\n\n";
  }

  // Footer
  content += "---\n\n";
  content += `**Full Changelog**: [${version} on GitHub](https://github.com/ralphschuler/.screeps-gpt/releases/tag/v${version})\n`;

  return content;
}

/**
 * Write blog post to file
 */
function writeBlogPost(version: string, blogPost: BlogPost): void {
  const versionSlug = version.replace(/\./g, "-");
  const filename = `release-${versionSlug}.md`;
  const filepath = path.join(BLOG_POSTS_DIR, filename);

  // Generate front matter
  const frontMatter = [
    "---",
    `title: "${blogPost.title}"`,
    `date: ${blogPost.date}`,
    "categories:",
    ...blogPost.categories.map(cat => `  - ${cat}`),
    "tags:",
    ...blogPost.tags.map(tag => `  - ${tag}`),
    "---",
    ""
  ].join("\n");

  const fullContent = frontMatter + blogPost.content;

  // Ensure directory exists
  fs.mkdirSync(BLOG_POSTS_DIR, { recursive: true });

  // Write file
  fs.writeFileSync(filepath, fullContent, "utf-8");
  console.log(`✅ Generated: ${filename}`);
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Parsing CHANGELOG.md...");
  const releases = parseChangelog();
  console.log(`📊 Found ${releases.length} releases in CHANGELOG.md`);

  console.log("\n🔍 Checking existing blog posts...");
  const existing = getExistingBlogPosts();
  console.log(`📊 Found ${existing.size} existing blog posts`);

  const missing = releases.filter(r => !existing.has(r.version));
  console.log(`📊 Missing ${missing.length} blog posts`);

  if (missing.length === 0) {
    console.log("\n✅ All blog posts already exist!");
    return;
  }

  console.log("\n📝 Generating missing blog posts...\n");

  for (const release of missing) {
    try {
      const blogPost = generateBlogPost(release);
      writeBlogPost(release.version, blogPost);
    } catch (error) {
      console.error(`❌ Failed to generate blog post for ${release.version}:`, error);
    }
  }

  console.log(`\n✅ Successfully generated ${missing.length} blog posts!`);
  console.log(`📁 Blog posts saved to: ${BLOG_POSTS_DIR}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
