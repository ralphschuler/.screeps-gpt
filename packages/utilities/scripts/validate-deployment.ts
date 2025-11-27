import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { checkBotAliveness } from "./check-bot-aliveness.js";
import type { BotSnapshot } from "./types/bot-snapshot";

/**
 * Validation check results
 */
interface ValidationChecks {
  /** Whether the bot code is executing (CPU usage > 0) */
  codeExecuting: boolean;
  /** Whether spawning is working (spawn queue active OR creeps exist) */
  spawningWorking: boolean;
  /** Whether Memory is initialized (has data) */
  memoryInitialized: boolean;
  /** Whether the bot aliveness API reports active status */
  alivenessActive: boolean;
}

/**
 * Metrics collected during validation
 */
interface ValidationMetrics {
  cpuUsed: number;
  cpuBucket: number;
  creepCount: number;
  roomCount: number;
  spawnCount: number;
}

/**
 * Deployment validation result
 */
export interface DeploymentValidation {
  timestamp: string;
  isHealthy: boolean;
  checks: ValidationChecks;
  metrics: ValidationMetrics;
  recommendation: "continue" | "monitor" | "rollback";
  failureReason: string | null;
  details: string;
}

/**
 * Check if spawning is working based on bot snapshot data.
 * Spawning is considered working if we have creeps OR active spawns OR spawns exist.
 *
 * @param snapshot - The bot snapshot to check
 * @returns Whether spawning is working
 */
function isSpawningWorking(snapshot: BotSnapshot): boolean {
  return (
    (snapshot.creeps?.total || 0) > 0 ||
    (snapshot.spawns?.active || 0) > 0 ||
    (snapshot.spawns?.total || 0) > 0
  );
}

/**
 * Load the most recent bot snapshot from reports/bot-snapshots/
 * Uses efficient single-pass reduction to find the latest file without sorting all files.
 */
function loadLatestSnapshot(): BotSnapshot | null {
  const snapshotsDir = resolve("reports", "bot-snapshots");

  if (!existsSync(snapshotsDir)) {
    console.log("  ⚠ No snapshots directory found");
    return null;
  }

  try {
    const latestFile = readdirSync(snapshotsDir)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => {
        const path = resolve(snapshotsDir, f);
        return { name: f, path, mtime: statSync(path).mtime };
      })
      .reduce(
        (latest, current) =>
          !latest || current.mtime > latest.mtime ? current : latest,
        null as { name: string; path: string; mtime: Date } | null
      );

    if (!latestFile) {
      console.log("  ⚠ No snapshot files found");
      return null;
    }

    const content = readFileSync(latestFile.path, "utf-8");
    const snapshot = JSON.parse(content) as BotSnapshot;
    console.log(`  ✓ Loaded snapshot: ${latestFile.name}`);
    return snapshot;
  } catch (error) {
    console.warn("  ⚠ Failed to load snapshot:", error);
    return null;
  }
}

/**
 * Load the latest screeps stats from reports/screeps-stats/
 */
function loadLatestStats(): { cpu?: { used: number }; bucket?: number } | null {
  const statsPath = resolve("reports", "screeps-stats", "latest.json");

  if (!existsSync(statsPath)) {
    console.log("  ⚠ No stats file found");
    return null;
  }

  try {
    const content = readFileSync(statsPath, "utf-8");
    const data = JSON.parse(content);

    // Check if this is a failure snapshot
    if (data.status === "console_unavailable") {
      console.log("  ⚠ Stats unavailable (console error)");
      return null;
    }

    // Extract CPU from stats payload
    if (data.payload?.stats) {
      const statKeys = Object.keys(data.payload.stats).sort().reverse();
      if (statKeys.length > 0) {
        const latestStats = data.payload.stats[statKeys[0]];
        return {
          cpu: latestStats.cpu,
          bucket: latestStats.bucket || data.payload.stats[statKeys[0]]?.bucket
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("  ⚠ Failed to load stats:", error);
    return null;
  }
}

/**
 * Validate deployment health by checking multiple sources
 */
async function validateDeployment(): Promise<DeploymentValidation> {
  const timestamp = new Date().toISOString();
  console.log(`\n🔍 Validating deployment health at ${timestamp}\n`);

  // Initialize validation result
  const validation: DeploymentValidation = {
    timestamp,
    isHealthy: false,
    checks: {
      codeExecuting: false,
      spawningWorking: false,
      memoryInitialized: false,
      alivenessActive: false
    },
    metrics: {
      cpuUsed: 0,
      cpuBucket: 0,
      creepCount: 0,
      roomCount: 0,
      spawnCount: 0
    },
    recommendation: "rollback",
    failureReason: null,
    details: ""
  };

  // Step 1: Check bot aliveness via API
  console.log("Step 1: Checking bot aliveness via API...");
  try {
    const alivenessResult = await checkBotAliveness();
    validation.checks.alivenessActive = alivenessResult.aliveness === "active";

    if (validation.checks.alivenessActive) {
      console.log("  ✓ Bot is active and executing");
    } else {
      console.log(`  ⚠ Bot aliveness: ${alivenessResult.aliveness}`);
      if (alivenessResult.error) {
        console.log(`    Error: ${alivenessResult.error}`);
      }
    }
  } catch (error) {
    console.warn("  ⚠ Aliveness check failed:", error);
  }

  // Step 2: Load and analyze bot snapshot
  console.log("\nStep 2: Analyzing bot snapshot...");
  const snapshot = loadLatestSnapshot();

  if (snapshot) {
    // Check CPU usage
    if (snapshot.cpu) {
      validation.metrics.cpuUsed = snapshot.cpu.used || 0;
      validation.metrics.cpuBucket = snapshot.cpu.bucket || 0;
      validation.checks.codeExecuting = validation.metrics.cpuUsed > 0;
      console.log(`  CPU: ${validation.metrics.cpuUsed.toFixed(2)} (bucket: ${validation.metrics.cpuBucket})`);
    }

    // Check creeps and spawns
    if (snapshot.creeps) {
      validation.metrics.creepCount = snapshot.creeps.total || 0;
      console.log(`  Creeps: ${validation.metrics.creepCount}`);
    }

    if (snapshot.spawns) {
      validation.metrics.spawnCount = snapshot.spawns.total || 0;
      console.log(`  Spawns: ${validation.metrics.spawnCount} (active: ${snapshot.spawns.active || 0})`);
    }

    // Check rooms
    if (snapshot.rooms) {
      validation.metrics.roomCount = Object.keys(snapshot.rooms).length;
      console.log(`  Rooms: ${validation.metrics.roomCount}`);
    }

    // Check memory initialization
    if (snapshot.memory) {
      validation.checks.memoryInitialized = snapshot.memory.used > 0;
      console.log(`  Memory: ${snapshot.memory.used} bytes`);
    }

    // Use helper function to check spawning status
    validation.checks.spawningWorking = isSpawningWorking(snapshot);
  } else {
    console.log("  ⚠ No snapshot available for analysis");

    // Fallback to stats API
    console.log("\nStep 2b: Falling back to stats API...");
    const stats = loadLatestStats();
    if (stats?.cpu) {
      validation.metrics.cpuUsed = stats.cpu.used || 0;
      validation.checks.codeExecuting = validation.metrics.cpuUsed > 0;
      console.log(`  CPU from stats: ${validation.metrics.cpuUsed.toFixed(2)}`);
    }
  }

  // Step 3: Determine health and recommendation
  console.log("\nStep 3: Determining deployment health...");

  // Determine if deployment is healthy
  // Primary criteria: code must be executing (CPU > 0) OR aliveness API says active
  const criticalChecks = validation.checks.codeExecuting || validation.checks.alivenessActive;

  if (criticalChecks) {
    // Code is executing - deployment is at minimum functional
    if (validation.checks.spawningWorking) {
      // Full health - code executing and spawning/creeps present
      validation.isHealthy = true;
      validation.recommendation = "continue";
      validation.details = "Deployment healthy: Code executing, spawning operational";
      console.log("  ✓ Deployment is HEALTHY");
    } else {
      // Partial health - code executing but no creeps (might be respawn scenario)
      validation.isHealthy = true;
      validation.recommendation = "monitor";
      validation.failureReason = "no_creeps";
      validation.details = "Code executing but no creeps detected - monitor for spawn activity";
      console.log("  ⚠ Deployment needs monitoring: No creeps detected");
    }
  } else {
    // Critical failure - code not executing
    validation.isHealthy = false;
    validation.recommendation = "rollback";

    if (validation.metrics.cpuUsed === 0 && !validation.checks.alivenessActive) {
      validation.failureReason = "zero_cpu";
      validation.details = "Critical: No CPU usage detected - code may not be executing";
    } else {
      validation.failureReason = "unknown";
      validation.details = "Critical: Unable to confirm code execution";
    }

    console.log(`  ❌ Deployment FAILED: ${validation.failureReason}`);
  }

  return validation;
}

/**
 * Save validation result to reports/deployments/
 */
function saveValidationResult(validation: DeploymentValidation): void {
  const deploymentsDir = resolve("reports", "deployments");
  mkdirSync(deploymentsDir, { recursive: true });

  const validationPath = resolve(deploymentsDir, "validation-latest.json");
  writeFileSync(validationPath, JSON.stringify(validation, null, 2));
  console.log(`\n💾 Validation result saved to: ${validationPath}`);
}

/**
 * Main entry point for deployment validation.
 *
 * Exit Codes (used by GitHub Actions workflow):
 * - 0: Deployment is healthy, recommendation is "continue"
 * - 1: Deployment needs monitoring, recommendation is "monitor" (code executing but no creeps)
 * - 2: Deployment failed validation, recommendation is "rollback" (critical failure)
 *
 * The workflow uses these exit codes to determine whether to rollback and create failure issues.
 */
async function main(): Promise<void> {
  const validation = await validateDeployment();

  // Save result
  saveValidationResult(validation);

  // Print summary
  console.log("\n=== Deployment Validation Summary ===");
  console.log(`Healthy: ${validation.isHealthy ? "YES" : "NO"}`);
  console.log(`Recommendation: ${validation.recommendation.toUpperCase()}`);
  console.log(`Details: ${validation.details}`);

  if (validation.failureReason) {
    console.log(`Failure Reason: ${validation.failureReason}`);
  }

  console.log("\nChecks:");
  console.log(`  Code Executing: ${validation.checks.codeExecuting ? "✓" : "✗"}`);
  console.log(`  Spawning Working: ${validation.checks.spawningWorking ? "✓" : "✗"}`);
  console.log(`  Memory Initialized: ${validation.checks.memoryInitialized ? "✓" : "✗"}`);
  console.log(`  Aliveness Active: ${validation.checks.alivenessActive ? "✓" : "✗"}`);

  console.log("\nMetrics:");
  console.log(`  CPU Used: ${validation.metrics.cpuUsed.toFixed(2)}`);
  console.log(`  CPU Bucket: ${validation.metrics.cpuBucket}`);
  console.log(`  Creep Count: ${validation.metrics.creepCount}`);
  console.log(`  Room Count: ${validation.metrics.roomCount}`);
  console.log(`  Spawn Count: ${validation.metrics.spawnCount}`);

  // Exit with appropriate code (see TSDoc above for exit code contract)
  if (validation.recommendation === "continue") {
    process.exit(0);
  } else if (validation.recommendation === "monitor") {
    process.exit(1);
  } else {
    process.exit(2);
  }
}

// Run if executed directly (cross-platform compatible)
const currentFilePath = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] && resolve(process.argv[1]) === currentFilePath;
if (isMainModule) {
  main().catch(error => {
    console.error("Unexpected error during validation:", error);
    process.exit(2);
  });
}

export { validateDeployment, loadLatestSnapshot, isSpawningWorking };
