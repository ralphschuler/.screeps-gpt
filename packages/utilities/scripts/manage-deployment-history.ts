import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import type {
  DeploymentHistory,
  ValidatedDeployment,
  DeploymentValidationMetrics
} from "./types/deployment-history.js";
import { MAX_HISTORY_SIZE, createEmptyHistory } from "./types/deployment-history.js";

/**
 * Path to the deployment history file
 */
const HISTORY_FILE_PATH = resolve("reports", "deployments", "deployment-history.json");

/**
 * Path to the latest validation file (output from validate-deployment.ts)
 */
const VALIDATION_FILE_PATH = resolve("reports", "deployments", "validation-latest.json");

/**
 * Load deployment history from file
 *
 * @returns The deployment history, or an empty history if file doesn't exist
 */
export function loadDeploymentHistory(): DeploymentHistory {
  if (!existsSync(HISTORY_FILE_PATH)) {
    return createEmptyHistory();
  }

  try {
    const content = readFileSync(HISTORY_FILE_PATH, "utf-8");
    const history = JSON.parse(content) as DeploymentHistory;

    // Validate basic structure
    if (!history.history || !Array.isArray(history.history)) {
      console.warn("⚠ Invalid deployment history structure, creating new history");
      return createEmptyHistory();
    }

    return history;
  } catch (error) {
    console.warn("⚠ Failed to load deployment history:", error);
    return createEmptyHistory();
  }
}

/**
 * Save deployment history to file
 *
 * @param history - The deployment history to save
 */
export function saveDeploymentHistory(history: DeploymentHistory): void {
  const deploymentsDir = resolve("reports", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });

  // Update the lastUpdated timestamp
  history.lastUpdated = new Date().toISOString();

  writeFileSync(HISTORY_FILE_PATH, JSON.stringify(history, null, 2));
  console.log(`✓ Deployment history saved to: ${HISTORY_FILE_PATH}`);
}

/**
 * Record a validated deployment in history
 *
 * @param version - The version tag (e.g., "v0.175.4")
 * @param commitSha - The git commit SHA
 * @param metrics - Validation metrics from health check
 * @param workflowRunUrl - URL to the GitHub Actions workflow run
 */
export function recordValidatedDeployment(
  version: string,
  commitSha: string,
  metrics: DeploymentValidationMetrics,
  workflowRunUrl: string
): void {
  const history = loadDeploymentHistory();

  const entry: ValidatedDeployment = {
    version,
    validatedAt: new Date().toISOString(),
    commitSha,
    validation: metrics,
    workflowRunUrl
  };

  // Check if this version is already in history (avoid duplicates)
  const existingIndex = history.history.findIndex(h => h.version === version);
  if (existingIndex >= 0) {
    // Update existing entry
    history.history[existingIndex] = entry;
    console.log(`✓ Updated existing history entry for ${version}`);
  } else {
    // Add new entry at the beginning
    history.history.unshift(entry);
    console.log(`✓ Added new history entry for ${version}`);
  }

  // Trim history to max size
  if (history.history.length > MAX_HISTORY_SIZE) {
    const removed = history.history.splice(MAX_HISTORY_SIZE);
    console.log(`  Trimmed ${removed.length} old entries from history`);
  }

  // Update quick-access fields
  history.lastValidated = version;
  history.lastValidatedCommit = commitSha;

  saveDeploymentHistory(history);
}

/**
 * Get the last validated version for rollback
 *
 * When rolling back from a failed deployment, this function returns
 * the most recent validated version that is NOT the current failed version.
 *
 * @param currentVersion - The current (failed) version to exclude from results
 * @returns The version tag to rollback to, or null if no valid rollback target exists
 */
export function getLastValidatedVersion(currentVersion: string): string | null {
  const history = loadDeploymentHistory();

  // Find the first entry that is not the current version
  for (const entry of history.history) {
    if (entry.version !== currentVersion) {
      console.error(`✓ Found rollback target: ${entry.version} (validated at ${entry.validatedAt})`);
      return entry.version;
    }
  }

  console.warn("⚠ No valid rollback target found in deployment history");
  return null;
}

/**
 * Get the commit SHA for a specific version from history
 *
 * @param version - The version tag to look up
 * @returns The commit SHA, or null if not found
 */
export function getCommitForVersion(version: string): string | null {
  const history = loadDeploymentHistory();

  const entry = history.history.find(h => h.version === version);
  if (entry) {
    return entry.commitSha;
  }

  return null;
}

/**
 * Load validation metrics from the latest validation file
 *
 * @returns Validation metrics or null if not available
 */
function loadValidationMetrics(): DeploymentValidationMetrics | null {
  if (!existsSync(VALIDATION_FILE_PATH)) {
    console.warn("⚠ No validation file found");
    return null;
  }

  try {
    const content = readFileSync(VALIDATION_FILE_PATH, "utf-8");
    const validation = JSON.parse(content);

    if (validation.metrics) {
      return {
        cpuUsed: validation.metrics.cpuUsed || 0,
        cpuBucket: validation.metrics.cpuBucket || 0,
        creepCount: validation.metrics.creepCount || 0,
        roomCount: validation.metrics.roomCount || 0,
        spawnCount: validation.metrics.spawnCount || 0
      };
    }

    return null;
  } catch (error) {
    console.warn("⚠ Failed to load validation metrics:", error);
    return null;
  }
}

/**
 * CLI: Record validated deployment
 *
 * Usage: npx tsx manage-deployment-history.ts <command> [args]
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "record") {
    // Record a validated deployment
    const version = args[1];
    const commitSha = args[2];
    const workflowRunUrl = args[3];

    if (!version || !commitSha || !workflowRunUrl) {
      console.error("Usage: record <version> <commit_sha> <workflow_run_url>");
      process.exit(1);
    }

    console.log(`\n📝 Recording validated deployment: ${version}\n`);

    // Load metrics from validation file
    const metrics = loadValidationMetrics() || {
      cpuUsed: 0,
      cpuBucket: 0,
      creepCount: 0,
      roomCount: 0,
      spawnCount: 0
    };

    recordValidatedDeployment(version, commitSha, metrics, workflowRunUrl);
    console.log("\n✓ Deployment recorded successfully");
  } else if (command === "get-rollback-target") {
    // Get rollback target
    const currentVersion = args[1];

    if (!currentVersion) {
      console.error("Usage: get-rollback-target <current_version>");
      process.exit(1);
    }

    console.error(`\n🔍 Finding rollback target (excluding ${currentVersion})\n`);

    const target = getLastValidatedVersion(currentVersion);
    if (target) {
      // Output just the version for shell script consumption
      console.log(`ROLLBACK_TARGET=${target}`);
      process.exit(0);
    } else {
      console.error("No valid rollback target found");
      process.exit(1);
    }
  } else if (command === "show") {
    // Show current history
    console.log("\n📜 Deployment History\n");

    const history = loadDeploymentHistory();
    console.log(`Last Validated: ${history.lastValidated || "none"}`);
    console.log(`Last Updated: ${history.lastUpdated}`);
    console.log(`\nHistory (${history.history.length} entries):`);

    for (const entry of history.history) {
      console.log(`\n  ${entry.version}`);
      console.log(`    Validated: ${entry.validatedAt}`);
      console.log(`    Commit: ${entry.commitSha}`);
      console.log(`    CPU: ${entry.validation.cpuUsed.toFixed(2)}`);
      console.log(`    Creeps: ${entry.validation.creepCount}`);
    }
  } else {
    console.log(`
Deployment History Manager

Commands:
  record <version> <commit_sha> <workflow_url>  Record a validated deployment
  get-rollback-target <current_version>         Get the rollback target version
  show                                          Display current deployment history

Examples:
  npx tsx manage-deployment-history.ts record v0.175.4 abc123 https://github.com/...
  npx tsx manage-deployment-history.ts get-rollback-target v0.175.5
  npx tsx manage-deployment-history.ts show
`);
  }
}

// Run if executed directly
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && resolve(process.argv[1]) === currentFilePath;
if (isMainModule) {
  main().catch(error => {
    console.error("Error:", error);
    process.exit(1);
  });
}

export { loadValidationMetrics, HISTORY_FILE_PATH };
