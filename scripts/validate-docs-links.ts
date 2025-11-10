/**
 * Documentation Link Validation Script
 *
 * Validates all internal links in documentation markdown files to ensure
 * they point to valid files or headings. Prevents broken links from being
 * deployed to the documentation site.
 *
 * Related Issues:
 * - Issue #497: test(e2e): add end-to-end tests for documentation site
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";

interface LinkValidationResult {
  broken: Array<{ file: string; link: string; reason: string }>;
  valid: string[];
  summary: {
    totalFiles: number;
    totalLinks: number;
    brokenLinks: number;
    validLinks: number;
  };
}

/**
 * Extract markdown links from content
 * Matches both inline links [text](url) and reference links [text]: url
 */
function extractMarkdownLinks(content: string): string[] {
  const links: string[] = [];

  // Match inline links: [text](url)
  const inlinePattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = inlinePattern.exec(content)) !== null) {
    const link = match[2].split("#")[0].trim(); // Remove anchor, keep path
    if (link && !isExternalLink(link) && !isSpecialProtocol(link)) {
      links.push(link);
    }
  }

  // Match reference links: [id]: url
  const referencePattern = /^\[([^\]]+)\]:\s*(.+)$/gm;
  while ((match = referencePattern.exec(content)) !== null) {
    const link = match[2].split("#")[0].trim();
    if (link && !isExternalLink(link) && !isSpecialProtocol(link)) {
      links.push(link);
    }
  }

  return links;
}

/**
 * Check if a link is an external URL
 */
function isExternalLink(link: string): boolean {
  return link.startsWith("http://") || link.startsWith("https://") || link.startsWith("//");
}

/**
 * Check if a link uses a special protocol
 */
function isSpecialProtocol(link: string): boolean {
  return (
    link.startsWith("mailto:") ||
    link.startsWith("tel:") ||
    link.startsWith("javascript:") ||
    link.startsWith("data:") ||
    link.startsWith("#")
  );
}

/**
 * Find all markdown files in a directory recursively
 */
function findMarkdownFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules, .git, and other hidden directories
        if (!entry.startsWith(".") && entry !== "node_modules" && entry !== "dist" && entry !== "build") {
          traverse(fullPath);
        }
      } else if (stat.isFile() && (entry.endsWith(".md") || entry.endsWith(".markdown"))) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Validate if a link points to a valid file
 */
function isValidLink(link: string, sourceFile: string, docsDir: string): { valid: boolean; reason?: string } {
  // Handle absolute paths from repository root
  if (link.startsWith("/")) {
    const absolutePath = join(docsDir, link.substring(1));
    const markdownPath = absolutePath.endsWith(".md") ? absolutePath : `${absolutePath}.md`;
    const indexPath = join(absolutePath, "index.md");

    if (existsSync(markdownPath)) {
      return { valid: true };
    } else if (existsSync(indexPath)) {
      return { valid: true };
    } else if (existsSync(absolutePath) && statSync(absolutePath).isDirectory()) {
      // Directory exists but no index.md
      return { valid: false, reason: "Directory exists but missing index.md" };
    }
    return { valid: false, reason: "File not found" };
  }

  // Handle relative paths
  const sourceDir = dirname(sourceFile);
  const resolvedPath = resolve(sourceDir, link);

  // Find repository root (parent of docsDir if docsDir is source/)
  const repoRoot = docsDir.endsWith("source") ? dirname(docsDir) : docsDir;

  // Check various possible file locations
  const possiblePaths = [
    resolvedPath,
    resolvedPath.endsWith(".md") ? resolvedPath : `${resolvedPath}.md`,
    join(resolvedPath, "index.md"),
    join(resolvedPath, "README.md"),
    // Also check at repository root for common files
    join(repoRoot, link),
    join(repoRoot, link.endsWith(".md") ? link : `${link}.md`)
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      const stat = statSync(path);
      if (stat.isFile()) {
        return { valid: true };
      }
    }
  }

  return { valid: false, reason: "File not found at any expected location" };
}

/**
 * Validate all documentation links
 */
export async function validateDocLinks(docsDir: string): Promise<LinkValidationResult> {
  const result: LinkValidationResult = {
    broken: [],
    valid: [],
    summary: {
      totalFiles: 0,
      totalLinks: 0,
      brokenLinks: 0,
      validLinks: 0
    }
  };

  console.log(`\n🔍 Validating documentation links in: ${docsDir}\n`);

  const markdownFiles = findMarkdownFiles(docsDir);
  result.summary.totalFiles = markdownFiles.length;

  console.log(`Found ${markdownFiles.length} markdown files\n`);

  for (const file of markdownFiles) {
    const content = readFileSync(file, "utf-8");
    const links = extractMarkdownLinks(content);

    for (const link of links) {
      result.summary.totalLinks++;

      const validation = isValidLink(link, file, docsDir);

      if (validation.valid) {
        result.valid.push(link);
        result.summary.validLinks++;
      } else {
        const relativeFile = relative(docsDir, file);
        result.broken.push({
          file: relativeFile,
          link,
          reason: validation.reason || "Unknown error"
        });
        result.summary.brokenLinks++;
        console.error(`❌ ${relativeFile}: ${link}`);
        console.error(`   Reason: ${validation.reason}`);
      }
    }
  }

  return result;
}

/**
 * Main execution
 */
async function main() {
  const docsDir = process.argv[2] || join(process.cwd(), "source");

  if (!existsSync(docsDir)) {
    console.error(`Error: Directory not found: ${docsDir}`);
    process.exit(1);
  }

  console.log("Documentation Link Validator");
  console.log("============================");

  const result = await validateDocLinks(docsDir);

  console.log("\n📊 Summary");
  console.log("==========");
  console.log(`Total files scanned: ${result.summary.totalFiles}`);
  console.log(`Total links found: ${result.summary.totalLinks}`);
  console.log(`Valid links: ${result.summary.validLinks} ✅`);
  console.log(`Broken links: ${result.summary.brokenLinks} ❌`);

  if (result.summary.brokenLinks > 0) {
    console.error("\n❌ Link validation failed!");
    console.error(`Found ${result.summary.brokenLinks} broken link(s)\n`);
    process.exit(1);
  }

  console.log("\n✅ All links are valid!\n");
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Validation error:", error);
    process.exit(1);
  });
}
