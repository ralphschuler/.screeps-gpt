import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inc, valid, parse } from "semver";

/**
 * Analyze commits since last version tag to determine version bump type.
 * Uses conventional commits format to determine semantic version increment.
 *
 * Breaking changes (BREAKING CHANGE in body or footer, or ! after type):
 *   - Major version bump (1.0.0 -> 2.0.0)
 *
 * New features (feat:):
 *   - Minor version bump (1.0.0 -> 1.1.0)
 *
 * Bug fixes, chores, docs, etc (fix:, chore:, docs:):
 *   - Patch version bump (1.0.0 -> 1.0.1)
 */

interface CommitInfo {
  message: string;
  body: string;
}

function getCommitsSinceLastTag(): CommitInfo[] {
  try {
    // Get the last version tag
    const lastTag = execSync('git describe --tags --abbrev=0 --match "v*" 2>/dev/null || echo ""', {
      encoding: "utf8"
    }).trim();

    // Get commits since last tag, or all commits if no tag exists
    const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
    const commitMessages = execSync(`git log ${range} --format="%s%n%b%n---COMMIT_SEPARATOR---"`, {
      encoding: "utf8"
    })
      .trim()
      .split("---COMMIT_SEPARATOR---")
      .filter(msg => msg.trim().length > 0);

    return commitMessages.map(msg => {
      const lines = msg.trim().split("\n");
      const message = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      return { message, body };
    });
  } catch {
    console.warn("Warning: Could not retrieve git commits, defaulting to patch bump");
    return [];
  }
}

function determineVersionBump(commits: CommitInfo[]): "major" | "minor" | "patch" {
  let hasBreaking = false;
  let hasFeature = false;

  for (const commit of commits) {
    const { message, body } = commit;

    // Check for breaking changes
    // Format 1: BREAKING CHANGE: in body or footer
    if (body.includes("BREAKING CHANGE:") || body.includes("BREAKING-CHANGE:")) {
      hasBreaking = true;
      break;
    }

    // Format 2: ! after type/scope (e.g., feat!:, fix(scope)!:)
    if (/^[a-z]+(\([^)]+\))?!:/.test(message)) {
      hasBreaking = true;
      break;
    }

    // Check for features
    if (/^feat(\([^)]+\))?:/.test(message)) {
      hasFeature = true;
    }
  }

  if (hasBreaking) {
    return "major";
  }
  if (hasFeature) {
    return "minor";
  }
  return "patch";
}

async function bump(): Promise<void> {
  const pkgPath = resolve("package.json");
  const content = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(content) as { version: string };

  if (!valid(pkg.version)) {
    throw new Error(`Invalid version in package.json: ${pkg.version}`);
  }

  // Parse current version to check if we're in 0.x.y (pre-1.0)
  const parsed = parse(pkg.version);
  const isPreRelease = parsed && parsed.major === 0;

  // Get commits and determine bump type
  const commits = getCommitsSinceLastTag();
  let bumpType = determineVersionBump(commits);

  // In pre-1.0 versions, treat major bumps as minor bumps per semver spec
  // Breaking changes in 0.x.y should increment minor version
  if (isPreRelease && bumpType === "major") {
    console.log("Pre-1.0 version detected: converting major bump to minor bump");
    bumpType = "minor";
  }

  const next = inc(pkg.version, bumpType);
  if (!next) {
    throw new Error("Unable to calculate next version");
  }

  pkg.version = next;
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");

  // Output both version and bump type for workflow use
  console.log(next);
  console.error(`Bump type: ${bumpType}`);
}

bump().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
