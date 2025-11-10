import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { releaseVersion } from "./lib/changelog";

/**
 * Script to update CHANGELOG.md when releasing a new version.
 * Moves unreleased changes to a new version section with the provided version and date.
 */

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error("Usage: tsx scripts/release-changelog.ts <version> <date>");
    console.error("Example: tsx scripts/release-changelog.ts 0.5.41 2024-06-01");
    process.exitCode = 1;
    return;
  }

  const [version, date] = args;

  const changelogPath = resolve("CHANGELOG.md");
  const content = await readFile(changelogPath, "utf8");

  const updated = releaseVersion(content, version, date);

  await writeFile(changelogPath, updated, "utf8");

  console.log(`Released version ${version} in CHANGELOG.md`);
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
