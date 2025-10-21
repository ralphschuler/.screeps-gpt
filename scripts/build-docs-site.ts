import { mkdir, readFile, readdir, rm, stat, writeFile, copyFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { marked } from "marked";
import { parseChangelog } from "./lib/changelog";

const outputDir = resolve("build/docs-site");
const assetsSource = resolve("docs/site-assets");

interface PageConfig {
  readonly sourcePath: string;
  readonly outputRelativePath: string;
  readonly title: string;
  readonly rawMarkdown?: string;
  readonly html?: string;
}

interface VersionEntry {
  readonly version: string;
  readonly date: string | null;
  readonly notes: readonly string[];
  readonly slug: string;
}

const renderer = new marked.Renderer();
const originalLink = renderer.link.bind(renderer);
renderer.link = (href, title, text) => {
  let nextHref = href ?? "";
  if (nextHref.endsWith(".md")) {
    nextHref = nextHref.replace(/\.md(#[^#]+)?$/, (_, anchor) => `.html${anchor ?? ""}`);
  }
  return originalLink(nextHref, title, text);
};
marked.use({ renderer, mangle: false, headerIds: true });

async function ensureEmptyDir(directory: string): Promise<void> {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

async function gatherMarkdownFiles(directory: string, base = directory): Promise<string[]> {
  const entries = await readdir(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
      const nested = await gatherMarkdownFiles(fullPath, base);
      files.push(...nested);
      continue;
    }
    if (stats.isFile() && extname(entry).toLowerCase() === ".md") {
      files.push(relative(base, fullPath));
    }
  }
  return files;
}

function firstHeading(markdown: string): string | undefined {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : undefined;
}

function resolveNavHref(fromOutputPath: string, targetRelative: string): string {
  const fromDir = dirname(fromOutputPath);
  const targetPath = join(outputDir, targetRelative);
  let relativePath = relative(fromDir, targetPath);
  if (!relativePath) {
    relativePath = targetRelative;
  }
  if (!relativePath.startsWith(".")) {
    relativePath = relativePath.replace(/\\/g, "/");
  }
  if (!relativePath || relativePath.startsWith("/")) {
    return targetRelative;
  }
  return relativePath.replace(/\\/g, "/");
}

function assetHref(fromOutputPath: string, assetRelative: string): string {
  const fromDir = dirname(fromOutputPath);
  const assetPath = join(outputDir, assetRelative);
  let relativePath = relative(fromDir, assetPath);
  if (!relativePath) {
    relativePath = assetRelative;
  }
  if (!relativePath.startsWith(".")) {
    relativePath = relativePath.replace(/\\/g, "/");
  }
  return relativePath.replace(/\\/g, "/");
}

function toPosix(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function renderLayout(title: string, bodyHtml: string, outputPath: string): string {
  const outputPosix = toPosix(outputPath);
  const navItems = [
    { label: "Home", path: "index.html" },
    { label: "Docs", path: "docs/index.html" },
    { label: "Changelog", path: "changelog/index.html" },
    { label: "Versions", path: "versions/index.html" }
  ];
  const navHtml = navItems
    .map(item => {
      const href = resolveNavHref(outputPath, item.path);
      const targetPosix = toPosix(join(outputDir, item.path));
      const isActive = outputPosix === targetPosix;
      const activeClass = isActive ? ' class="active"' : "";
      return `<a href="${href}"${activeClass}>${item.label}</a>`;
    })
    .join("");

  const stylesheetHref = assetHref(outputPath, "assets/style.css");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · Screeps GPT Docs</title>
    <link rel="stylesheet" href="${stylesheetHref}" />
  </head>
  <body>
    <header>
      <div class="container">
        <h1><a href="${resolveNavHref(outputPath, "index.html")}">Screeps GPT</a></h1>
        <nav>
          ${navHtml}
        </nav>
      </div>
    </header>
    <main>
      <article class="container">
        ${bodyHtml}
      </article>
    </main>
    <footer>
      <div class="container">
        <p>Generated from repository documentation and changelog.</p>
      </div>
    </footer>
  </body>
</html>
`;
}

async function renderMarkdownPage(page: PageConfig): Promise<void> {
  const markdown = page.rawMarkdown ?? (page.html ? "" : await readFile(page.sourcePath, "utf8"));
  const htmlContent = page.html ?? marked.parse(markdown);
  const title = page.title || firstHeading(markdown) || "Screeps GPT";
  const outputPath = join(outputDir, page.outputRelativePath);
  await mkdir(dirname(outputPath), { recursive: true });
  const fullHtml = renderLayout(title, htmlContent, outputPath);
  await writeFile(outputPath, fullHtml, "utf8");
}

async function copyAssetDirectory(source: string, destination: string): Promise<void> {
  const entries = await readdir(source, { withFileTypes: true });
  await mkdir(destination, { recursive: true });
  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const destinationPath = join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyAssetDirectory(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, destinationPath);
    }
  }
}

async function copyAssets(): Promise<void> {
  try {
    await copyAssetDirectory(assetsSource, join(outputDir, "assets"));
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === "string");
}

function parseVersionEntries(raw: unknown): VersionEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const entries: VersionEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const candidate = item as {
      version?: unknown;
      date?: unknown;
      notes?: unknown;
      slug?: unknown;
    };
    if (typeof candidate.version !== "string" || typeof candidate.slug !== "string") {
      continue;
    }
    const date = candidate.date;
    const normalizedDate = typeof date === "string" || date === null ? (date ?? null) : null;
    const notes = candidate.notes;
    const normalizedNotes = isStringArray(notes) ? notes : [];
    entries.push({
      version: candidate.version,
      date: normalizedDate,
      notes: normalizedNotes,
      slug: candidate.slug
    });
  }
  return entries;
}

async function buildSite(): Promise<void> {
  await ensureEmptyDir(outputDir);
  await copyAssets();

  // Home page from README
  const readmePath = resolve("README.md");
  const readmeMarkdown = await readFile(readmePath, "utf8");
  await renderMarkdownPage({
    sourcePath: readmePath,
    outputRelativePath: "index.html",
    title: firstHeading(readmeMarkdown) ?? "Screeps GPT",
    rawMarkdown: readmeMarkdown
  });

  // Documentation pages
  const docsDir = resolve("docs");
  const docFiles = await gatherMarkdownFiles(docsDir);
  for (const relativePath of docFiles) {
    const sourcePath = join(docsDir, relativePath);
    const rawMarkdown = await readFile(sourcePath, "utf8");
    const outputRelativePath = join("docs", relativePath.replace(/\.md$/i, ".html"));
    await renderMarkdownPage({
      sourcePath,
      outputRelativePath,
      title: firstHeading(rawMarkdown) ?? relativePath,
      rawMarkdown
    });
  }

  // Changelog overview and per-release pages
  const changelogPath = resolve("CHANGELOG.md");
  const changelogMarkdown = await readFile(changelogPath, "utf8");
  const changelogHtml = marked.parse(changelogMarkdown);
  await renderMarkdownPage({
    sourcePath: changelogPath,
    outputRelativePath: "changelog/index.html",
    title: "Changelog",
    html: changelogHtml
  });

  const parsedChangelog = parseChangelog(changelogMarkdown);
  for (const version of parsedChangelog.versions) {
    const headingLines = [`# ${version.version}`];
    if (version.date) {
      headingLines.push(`_Released on ${version.date}_`);
    }
    if (version.content) {
      headingLines.push("", version.content);
    }
    const versionMarkdown = headingLines.join("\n");
    await renderMarkdownPage({
      sourcePath: changelogPath,
      outputRelativePath: join("changelog", `${version.slug}.html`),
      title: `Changelog ${version.version}`,
      rawMarkdown: versionMarkdown
    });
  }

  // Release index page
  const versionsJsonPath = resolve("docs/changelog/versions.json");
  let versionEntries: VersionEntry[] = [];
  try {
    const versionsJson = await readFile(versionsJsonPath, "utf8");
    const parsed = JSON.parse(versionsJson) as unknown;
    versionEntries = parseVersionEntries(parsed);
  } catch (error: unknown) {
    console.warn("No versions.json found; run `pnpm run versions:update` before building the docs site.");
  }

  const versionSections = versionEntries
    .map(entry => {
      const notes = entry.notes.length
        ? `<ul>${entry.notes.map(note => `<li>${note}</li>`).join("")}</ul>`
        : "<p>No highlights recorded for this release.</p>";
      const link = resolveNavHref(join(outputDir, "versions/index.html"), join("changelog", `${entry.slug}.html`));
      const dateMarkup = entry.date ? `<span class="release-date">${entry.date}</span>` : "";
      return `
        <section class="release">
          <h2><a href="${link}">${entry.version}</a> ${dateMarkup}</h2>
          ${notes}
        </section>
      `;
    })
    .join("\n");

  const versionsHtml = `
    <h1>Release History</h1>
    <p>This page summarises all recorded releases. Each entry links to the full changelog for the version.</p>
    ${versionSections || "<p>No releases have been recorded yet.</p>"}
  `;

  await renderMarkdownPage({
    sourcePath: versionsJsonPath,
    outputRelativePath: "versions/index.html",
    title: "Release History",
    html: versionsHtml
  });
}

buildSite().catch(error => {
  console.error("Failed to build documentation site", error);
  process.exitCode = 1;
});
