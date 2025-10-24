export interface ChangelogSection {
  readonly heading: string;
  readonly anchor: string;
  readonly content: string;
  readonly notes: readonly string[];
}

export interface ChangelogVersion extends ChangelogSection {
  readonly version: string;
  readonly date?: string;
  readonly slug: string;
}

export interface ChangelogData {
  readonly unreleased?: ChangelogSection;
  readonly versions: readonly ChangelogVersion[];
}

interface RawSection {
  title: string;
  heading: string;
  date?: string;
  lines: string[];
}

interface ParsedHeading {
  title: string;
  date?: string;
  isUnreleased: boolean;
  version?: string;
}

function normaliseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sanitiseAnchor(value: string): string {
  return normaliseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9\- ]/g, "")
    .trim()
    .replace(/[\s]+/g, "-");
}

function toSlug(version: string): string {
  const base = version.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const trimmed = base.replace(/^-+|-+$/g, "");
  if (!trimmed) {
    return "release";
  }
  return `v${trimmed}`;
}

function extractNotes(lines: readonly string[]): string[] {
  const notes: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\s*[-*+]\s+(.*)$/);
    if (match) {
      notes.push(match[1].trim());
    }
  }
  return notes;
}

function parseHeading(line: string): ParsedHeading {
  const headingText = normaliseWhitespace(line.replace(/^##\s+/, ""));
  const bracketMatch = headingText.match(/^\[?([^\]]+)\]?(?:\s*-\s*(.*))?$/);
  const title = bracketMatch ? bracketMatch[1].trim() : headingText;
  const date = bracketMatch && bracketMatch[2] ? bracketMatch[2].trim() || undefined : undefined;
  const lowerTitle = title.toLowerCase();
  const isUnreleased = lowerTitle === "unreleased" || lowerTitle === "pending release";
  return { title, date, isUnreleased, version: isUnreleased ? undefined : title };
}

function toSection(raw: RawSection): ChangelogSection {
  const content = raw.lines.join("\n").trim();
  return {
    heading: raw.heading,
    anchor: sanitiseAnchor(raw.heading),
    content,
    notes: extractNotes(raw.lines)
  };
}

function toVersion(raw: RawSection, version: string, date?: string): ChangelogVersion {
  const section = toSection(raw);
  return {
    ...section,
    version,
    date,
    slug: toSlug(version)
  };
}

export function parseChangelog(markdown: string): ChangelogData {
  const lines = markdown.split(/\r?\n/);
  const sections: RawSection[] = [];

  let current: RawSection | undefined;
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current) {
        sections.push(current);
      }
      const heading = normaliseWhitespace(line.replace(/^##\s+/, ""));
      current = { title: heading, heading, lines: [] };
      continue;
    }
    if (!current) {
      continue;
    }
    current.lines.push(line);
  }

  if (current) {
    sections.push(current);
  }

  let unreleased: ChangelogSection | undefined;
  const versions: ChangelogVersion[] = [];

  for (const section of sections) {
    const heading = parseHeading(section.heading);
    if (heading.isUnreleased) {
      unreleased = toSection(section);
      continue;
    }
    if (!heading.version) {
      continue;
    }
    versions.push(toVersion(section, heading.version, heading.date));
  }

  return { unreleased, versions };
}

export function formatVersionLink(version: ChangelogVersion): string {
  const anchor = version.anchor || sanitiseAnchor(version.heading);
  const basenameAnchor = anchor ? `#${anchor}` : "";
  return `CHANGELOG.md${basenameAnchor}`;
}

/**
 * Checks if the given lines contain actual changelog entries.
 * Looks for lines that start with list markers (-, *, +) which indicate actual change entries,
 * not just empty subsection headers.
 *
 * @param lines - Array of changelog lines to check
 * @returns True if there are actual change entries, false otherwise
 */
function hasChangelogContent(lines: readonly string[]): boolean {
  return lines.some(line => {
    const trimmed = line.trim();
    return trimmed.startsWith("-") || trimmed.startsWith("*") || trimmed.startsWith("+");
  });
}

/**
 * Updates the changelog by moving unreleased changes to a new version section.
 * Clears the [Unreleased] section after creating the new version.
 *
 * @param markdown - The current changelog markdown content
 * @param version - The new version number (e.g., "0.5.41")
 * @param date - The release date (e.g., "2024-06-01")
 * @returns Updated changelog markdown
 */
export function releaseVersion(markdown: string, version: string, date: string): string {
  const lines = markdown.split(/\r?\n/);
  const result: string[] = [];
  let inUnreleased = false;
  const unreleasedContent: string[] = [];
  let foundUnreleased = false;
  let headerProcessed = false;

  // Regex pattern to match [Unreleased] or Unreleased with optional whitespace
  const unreleasedPattern = /^##\s*\[?Unreleased\]?/i;

  // Process the changelog line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect the [Unreleased] section using regex for consistency with parseChangelog
    if (unreleasedPattern.test(line)) {
      foundUnreleased = true;
      inUnreleased = true;
      // Add the header lines before [Unreleased]
      if (!headerProcessed) {
        headerProcessed = true;
      }
      result.push(line);
      result.push("");
      continue;
    }

    // Detect the next section (end of unreleased)
    if (inUnreleased && line.startsWith("## [") && !unreleasedPattern.test(line)) {
      inUnreleased = false;

      // Insert the new version section with unreleased content only if there's actual content
      if (hasChangelogContent(unreleasedContent)) {
        result.push(`## [${version}] - ${date}`);
        result.push("");
        result.push(...unreleasedContent);
        result.push("");
      }
      // Add the current line (next version section)
      result.push(line);
      continue;
    }

    // Collect unreleased content
    if (inUnreleased) {
      unreleasedContent.push(line);
      continue;
    }

    // Add all other lines as-is
    result.push(line);
  }

  // If we reached the end while still in unreleased section
  if (inUnreleased && hasChangelogContent(unreleasedContent)) {
    result.push(`## [${version}] - ${date}`);
    result.push("");
    result.push(...unreleasedContent);
    result.push("");
  }

  // If no unreleased section was found, add the new version at the top after the header
  if (!foundUnreleased) {
    const headerEndIndex = result.findIndex(line => line.startsWith("## "));
    if (headerEndIndex > 0) {
      result.splice(headerEndIndex, 0, `## [${version}] - ${date}`, "", "");
    }
  }

  return result.join("\n");
}
