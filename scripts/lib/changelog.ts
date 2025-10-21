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
