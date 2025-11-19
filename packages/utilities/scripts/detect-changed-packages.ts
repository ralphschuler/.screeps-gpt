#!/usr/bin/env tsx
/**
 * Detects which packages have changed files based on git diff
 * Used by pre-commit hooks to run tests only for affected packages
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface PackageInfo {
  name: string;
  path: string;
  hasTests: boolean;
}

/**
 * Get list of all packages in the monorepo
 */
function getAllPackages(): PackageInfo[] {
  const rootPackageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf-8"));

  const workspaces = rootPackageJson.workspaces || [];
  const packages: PackageInfo[] = [];

  for (const workspace of workspaces) {
    // Handle glob patterns like "packages/*"
    if (workspace.includes("*")) {
      const baseDir = workspace.replace("/*", "");
      try {
        const dirs = execSync(`ls -d ${baseDir}/*/`, { encoding: "utf-8" })
          .trim()
          .split("\n")
          .filter(dir => dir);

        for (const dir of dirs) {
          const pkgPath = dir.replace(/\/$/, "");
          const pkgJsonPath = join(pkgPath, "package.json");

          if (existsSync(pkgJsonPath)) {
            const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
            const hasTests = !!pkgJson.scripts?.test;

            packages.push({
              name: pkgJson.name || pkgPath.split("/").pop() || pkgPath,
              path: pkgPath,
              hasTests
            });
          }
        }
      } catch {
        // Skip if directory doesn't exist
      }
    }
  }

  return packages;
}

/**
 * Get list of changed files from git
 * Includes both staged and unstaged changes
 */
function getChangedFiles(): string[] {
  try {
    // Get staged files
    const staged = execSync("git diff --cached --name-only", { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter(f => f);

    // Get unstaged files
    const unstaged = execSync("git diff --name-only", { encoding: "utf-8" })
      .trim()
      .split("\n")
      .filter(f => f);

    // Combine and deduplicate
    return Array.from(new Set([...staged, ...unstaged]));
  } catch (error) {
    console.error("Error getting changed files:", error);
    return [];
  }
}

/**
 * Determine which packages have changes
 */
function detectChangedPackages(): {
  packages: PackageInfo[];
  hasRootChanges: boolean;
} {
  const allPackages = getAllPackages();
  const changedFiles = getChangedFiles();

  if (changedFiles.length === 0) {
    return { packages: [], hasRootChanges: false };
  }

  const changedPackages = new Set<PackageInfo>();
  let hasRootChanges = false;

  for (const file of changedFiles) {
    // Check if file is in a package directory
    const packageInfo = allPackages.find(pkg => file.startsWith(pkg.path + "/"));

    if (packageInfo) {
      changedPackages.add(packageInfo);
    } else if (
      // Root-level changes that affect everything
      file.startsWith("tests/") ||
      file === "package.json" ||
      file === "tsconfig.json" ||
      file === "vitest.config.ts" ||
      file.startsWith(".github/workflows/")
    ) {
      hasRootChanges = true;
    }
  }

  return {
    packages: Array.from(changedPackages),
    hasRootChanges
  };
}

/**
 * Main execution
 */
function main() {
  const { packages, hasRootChanges } = detectChangedPackages();

  if (hasRootChanges) {
    console.log("ROOT");
    return;
  }

  if (packages.length === 0) {
    console.log("NONE");
    return;
  }

  // Output package names, one per line
  for (const pkg of packages) {
    console.log(pkg.name);
  }
}

// Only run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { detectChangedPackages, getAllPackages, getChangedFiles };
