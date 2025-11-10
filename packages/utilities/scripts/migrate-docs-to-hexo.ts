import { copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, basename } from "node:path";

const docsDir = "docs";
const hexoSourceDir = "hexo-source";

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function copyMarkdownFiles(sourceDir: string, targetDir: string): Promise<void> {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      // Skip site-assets directory
      if (entry.name === "site-assets") {
        continue;
      }
      await ensureDir(targetPath);
      await copyMarkdownFiles(sourcePath, targetPath);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      // Read the file content
      const content = await readFile(sourcePath, "utf8");

      // Check if file already has front matter
      if (!content.startsWith("---")) {
        // Extract title from first heading or use filename
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : basename(entry.name, ".md");

        // Add front matter
        const frontMatter = `---
title: ${title}
date: ${new Date().toISOString()}
---

`;
        const newContent = frontMatter + content;
        await writeFile(targetPath, newContent, "utf8");
      } else {
        // Copy as-is if it already has front matter
        await copyFile(sourcePath, targetPath);
      }
    }
  }
}

async function createHomePage(): Promise<void> {
  const readmePath = "README.md";
  const homePagePath = join(hexoSourceDir, "index.md");

  const readmeContent = await readFile(readmePath, "utf8");

  // Extract title
  const titleMatch = readmeContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Screeps GPT";

  // Add front matter
  const frontMatter = `---
title: ${title}
layout: page
---

`;

  await writeFile(homePagePath, frontMatter + readmeContent, "utf8");
  console.log("✓ Created home page from README.md");
}

async function createSampleBlogPosts(): Promise<void> {
  const postsDir = join(hexoSourceDir, "_posts");
  await ensureDir(postsDir);

  // Create a welcome post
  const welcomePost = `---
title: Welcome to Screeps GPT Documentation
date: ${new Date().toISOString()}
categories:
  - Development Updates
tags:
  - announcement
  - documentation
---

Welcome to the new Hexo-powered Screeps GPT documentation site!

This site now features:

- **Enhanced Documentation**: All existing documentation has been migrated to a modern, searchable format
- **Blog Functionality**: Regular updates on development progress, automation insights, and performance improvements
- **RSS Feeds**: Subscribe to stay updated with the latest posts
- **Search**: Quickly find what you're looking for across all documentation and blog posts
- **Categories & Tags**: Organized content for easy navigation

## What's Next?

We'll be regularly posting updates in the following categories:

- **Development Updates**: New features, bug fixes, and code improvements
- **Automation Insights**: Deep dives into our AI-powered development workflows
- **Performance Reports**: Analysis of bot performance and optimization strategies
- **Community Highlights**: Contributions, discussions, and community engagement

Stay tuned for more updates!
`;

  await writeFile(join(postsDir, "welcome.md"), welcomePost, "utf8");
  console.log("✓ Created welcome blog post");
}

async function createChangelogPage(): Promise<void> {
  const changelogSource = "CHANGELOG.md";
  const changelogTarget = join(hexoSourceDir, "changelog", "index.md");

  await ensureDir(dirname(changelogTarget));

  const changelogContent = await readFile(changelogSource, "utf8");

  const frontMatter = `---
title: Changelog
layout: page
---

`;

  await writeFile(changelogTarget, frontMatter + changelogContent, "utf8");
  console.log("✓ Created changelog page");
}

async function main(): Promise<void> {
  console.log("Migrating documentation to Hexo format...\n");

  // Ensure hexo-source directory exists
  await ensureDir(hexoSourceDir);

  // Create home page from README
  await createHomePage();

  // Copy all markdown files from docs/
  const docsTarget = join(hexoSourceDir, "docs");
  await ensureDir(docsTarget);
  await copyMarkdownFiles(docsDir, docsTarget);
  console.log("✓ Copied documentation files");

  // Create changelog page
  await createChangelogPage();

  // Create sample blog posts
  await createSampleBlogPosts();

  console.log("\n✅ Migration complete!");
  console.log("\nNext steps:");
  console.log("1. Review migrated files in hexo-source/");
  console.log("2. Run 'bun run build:docs-site' to build the site");
  console.log("3. Preview the site by opening build/docs-site/index.html");
}

main().catch(error => {
  console.error("Migration failed:", error);
  process.exitCode = 1;
});
