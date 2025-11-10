import { describe, it, expect } from "vitest";
import { releaseVersion, parseChangelog } from "../../packages/utilities/scripts/lib/changelog";

describe("Changelog Release Management", () => {
  it("should move unreleased content to a new version section", () => {
    const changelog = `# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added

- Feature A
- Feature B

### Fixed

- Bug fix A

## [0.1.0] - 2024-06-01

- Initial release
`;

    const result = releaseVersion(changelog, "0.2.0", "2024-06-15");

    // Parse the result to verify structure
    const parsed = parseChangelog(result);

    // Should have the new version
    expect(parsed.versions).toHaveLength(2);
    expect(parsed.versions[0].version).toBe("0.2.0");
    expect(parsed.versions[0].date).toBe("2024-06-15");
    expect(parsed.versions[1].version).toBe("0.1.0");

    // New version should contain the unreleased content
    expect(parsed.versions[0].content).toContain("Feature A");
    expect(parsed.versions[0].content).toContain("Feature B");
    expect(parsed.versions[0].content).toContain("Bug fix A");

    // Unreleased section should still exist but be empty
    expect(result).toContain("## [Unreleased]");
  });

  it("should preserve existing version history", () => {
    const changelog = `# Changelog

## [Unreleased]

### Added

- New feature

## [0.2.0] - 2024-06-15

- Previous feature

## [0.1.0] - 2024-06-01

- Initial release
`;

    const result = releaseVersion(changelog, "0.3.0", "2024-07-01");
    const parsed = parseChangelog(result);

    // Should have all three versions
    expect(parsed.versions).toHaveLength(3);
    expect(parsed.versions[0].version).toBe("0.3.0");
    expect(parsed.versions[1].version).toBe("0.2.0");
    expect(parsed.versions[2].version).toBe("0.1.0");

    // Old versions should remain unchanged
    expect(parsed.versions[1].content).toContain("Previous feature");
    expect(parsed.versions[2].content).toContain("Initial release");
  });

  it("should handle empty unreleased section", () => {
    const changelog = `# Changelog

## [Unreleased]

## [0.1.0] - 2024-06-01

- Initial release
`;

    const result = releaseVersion(changelog, "0.2.0", "2024-06-15");

    // Should not create an empty version section
    expect(result).toContain("## [Unreleased]");
    expect(result).toContain("## [0.1.0]");

    // Parse to verify
    const parsed = parseChangelog(result);

    // Should only have the existing version since unreleased was empty
    expect(parsed.versions).toHaveLength(1);
    expect(parsed.versions[0].version).toBe("0.1.0");
  });

  it("should handle unreleased section with only subsection headers (no entries)", () => {
    const changelog = `# Changelog

## [Unreleased]

### Added

### Fixed

## [0.1.0] - 2024-06-01

- Initial release
`;

    const result = releaseVersion(changelog, "0.2.0", "2024-06-15");

    // Should not create a version section with only empty headers
    const parsed = parseChangelog(result);

    // Should only have the existing version since unreleased had no actual entries
    expect(parsed.versions).toHaveLength(1);
    expect(parsed.versions[0].version).toBe("0.1.0");
  });

  it("should handle unreleased section with subsections", () => {
    const changelog = `# Changelog

## [Unreleased]

### Added

- New feature A
- New feature B

### Fixed

- Bug fix A
- Bug fix B

### Changed

- Change A

## [0.1.0] - 2024-06-01

- Initial release
`;

    const result = releaseVersion(changelog, "0.2.0", "2024-06-15");
    const parsed = parseChangelog(result);

    // New version should contain all subsections
    expect(parsed.versions[0].content).toContain("### Added");
    expect(parsed.versions[0].content).toContain("### Fixed");
    expect(parsed.versions[0].content).toContain("### Changed");
    expect(parsed.versions[0].content).toContain("New feature A");
    expect(parsed.versions[0].content).toContain("Bug fix B");
    expect(parsed.versions[0].content).toContain("Change A");
  });

  it("should preserve changelog header", () => {
    const changelog = `# Changelog

All notable changes to this project are documented here. This changelog now maintains the full release history.

## [Unreleased]

### Added

- New feature

## [0.1.0] - 2024-06-01

- Initial release
`;

    const result = releaseVersion(changelog, "0.2.0", "2024-06-15");

    // Header should be preserved
    expect(result).toContain("# Changelog");
    expect(result).toContain("All notable changes to this project are documented here");
  });
});
