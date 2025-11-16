import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

interface HealthMetrics {
  snapshotHealth: {
    exists: boolean;
    isComplete: boolean;
    hasTimestamp: boolean;
    hasGameState: boolean;
    fields: string[];
    missingFields: string[];
  };
  ptrStatsHealth: {
    exists: boolean;
    isComplete: boolean;
    source: string;
    success: boolean;
    fallbackActivated: boolean;
    hasStats: boolean;
  };
  freshnessCheck: {
    snapshotAge: number | null;
    ptrStatsAge: number | null;
    snapshotStale: boolean;
    ptrStatsStale: boolean;
  };
  overallHealth: "healthy" | "degraded" | "critical";
  successRate: number;
  recommendations: string[];
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const REQUIRED_SNAPSHOT_FIELDS = ["timestamp", "cpu", "rooms", "creeps"];

/**
 * Validate bot snapshot completeness
 */
function validateSnapshot(snapshotPath: string): HealthMetrics["snapshotHealth"] {
  const health: HealthMetrics["snapshotHealth"] = {
    exists: false,
    isComplete: false,
    hasTimestamp: false,
    hasGameState: false,
    fields: [],
    missingFields: []
  };

  if (!existsSync(snapshotPath)) {
    health.missingFields = [...REQUIRED_SNAPSHOT_FIELDS];
    return health;
  }

  health.exists = true;

  try {
    const content = readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(content);

    // Collect all fields present
    health.fields = Object.keys(snapshot);
    health.hasTimestamp = "timestamp" in snapshot;

    // Check for game state fields (any field beyond timestamp means game state)
    health.hasGameState = health.fields.some(field => field !== "timestamp");

    // Check which required fields are missing
    health.missingFields = REQUIRED_SNAPSHOT_FIELDS.filter(field => !(field in snapshot));

    // Consider complete if all required fields are present
    health.isComplete = health.missingFields.length === 0;
  } catch (error) {
    console.error(`Failed to parse snapshot: ${error}`);
    health.missingFields = [...REQUIRED_SNAPSHOT_FIELDS];
  }

  return health;
}

/**
 * Validate PTR stats health
 */
function validatePTRStats(ptrStatsPath: string): HealthMetrics["ptrStatsHealth"] {
  const health: HealthMetrics["ptrStatsHealth"] = {
    exists: false,
    isComplete: false,
    source: "none",
    success: false,
    fallbackActivated: false,
    hasStats: false
  };

  if (!existsSync(ptrStatsPath)) {
    return health;
  }

  health.exists = true;

  try {
    const content = readFileSync(ptrStatsPath, "utf-8");
    const ptrStats = JSON.parse(content);

    if (ptrStats.metadata) {
      health.source = ptrStats.metadata.source || "none";
      health.success = ptrStats.metadata.success || false;
      health.fallbackActivated = ptrStats.metadata.fallbackActivated || false;
    }

    health.hasStats = !!(ptrStats.stats && Object.keys(ptrStats.stats).length > 0);
    health.isComplete = health.success && health.hasStats;
  } catch (error) {
    console.error(`Failed to parse PTR stats: ${error}`);
  }

  return health;
}

/**
 * Check file freshness
 */
function checkFreshness(snapshotPath: string, ptrStatsPath: string): HealthMetrics["freshnessCheck"] {
  const freshness: HealthMetrics["freshnessCheck"] = {
    snapshotAge: null,
    ptrStatsAge: null,
    snapshotStale: true,
    ptrStatsStale: true
  };

  if (existsSync(snapshotPath)) {
    const stats = statSync(snapshotPath);
    freshness.snapshotAge = Date.now() - stats.mtimeMs;
    freshness.snapshotStale = freshness.snapshotAge > STALE_THRESHOLD_MS;
  }

  if (existsSync(ptrStatsPath)) {
    const stats = statSync(ptrStatsPath);
    freshness.ptrStatsAge = Date.now() - stats.mtimeMs;
    freshness.ptrStatsStale = freshness.ptrStatsAge > STALE_THRESHOLD_MS;
  }

  return freshness;
}

/**
 * Calculate overall health and success rate
 */
function calculateOverallHealth(
  snapshotHealth: HealthMetrics["snapshotHealth"],
  ptrStatsHealth: HealthMetrics["ptrStatsHealth"],
  freshnessCheck: HealthMetrics["freshnessCheck"]
): { health: "healthy" | "degraded" | "critical"; successRate: number } {
  let successCount = 0;
  let totalChecks = 4;

  // Check 1: Snapshot completeness
  if (snapshotHealth.isComplete) successCount++;

  // Check 2: PTR stats completeness
  if (ptrStatsHealth.isComplete) successCount++;

  // Check 3: Snapshot freshness
  if (!freshnessCheck.snapshotStale) successCount++;

  // Check 4: PTR stats freshness
  if (!freshnessCheck.ptrStatsStale) successCount++;

  const successRate = (successCount / totalChecks) * 100;

  let health: "healthy" | "degraded" | "critical";
  if (successRate >= 95) {
    health = "healthy";
  } else if (successRate >= 75) {
    health = "degraded";
  } else {
    health = "critical";
  }

  return { health, successRate };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(metrics: Omit<HealthMetrics, "recommendations">): string[] {
  const recommendations: string[] = [];

  // Snapshot recommendations
  if (!metrics.snapshotHealth.exists) {
    recommendations.push("Run collect-bot-snapshot.ts to create initial snapshot");
  } else if (!metrics.snapshotHealth.isComplete) {
    recommendations.push(`Snapshot missing required fields: ${metrics.snapshotHealth.missingFields.join(", ")}`);
    recommendations.push("Verify Stats API or Console telemetry is available");
  }

  // PTR stats recommendations
  if (!metrics.ptrStatsHealth.exists) {
    recommendations.push("Run collect-ptr-stats.ts to create PTR stats file");
  } else if (!metrics.ptrStatsHealth.isComplete) {
    if (metrics.ptrStatsHealth.source === "none") {
      recommendations.push("All telemetry sources failed - check SCREEPS_TOKEN and connectivity");
    } else if (!metrics.ptrStatsHealth.hasStats) {
      recommendations.push("PTR stats file exists but contains no data");
    }
  }

  // Fallback notification
  if (metrics.ptrStatsHealth.fallbackActivated) {
    recommendations.push("INFO: Using console fallback - primary Stats API unavailable (non-critical)");
  }

  // Freshness recommendations
  if (metrics.freshnessCheck.snapshotStale && metrics.snapshotHealth.exists) {
    const ageMinutes = Math.floor((metrics.freshnessCheck.snapshotAge || 0) / 60000);
    recommendations.push(`Snapshot is stale (${ageMinutes} minutes old, threshold: 30 minutes)`);
  }

  if (metrics.freshnessCheck.ptrStatsStale && metrics.ptrStatsHealth.exists) {
    const ageMinutes = Math.floor((metrics.freshnessCheck.ptrStatsAge || 0) / 60000);
    recommendations.push(`PTR stats are stale (${ageMinutes} minutes old, threshold: 30 minutes)`);
  }

  if (recommendations.length === 0) {
    recommendations.push("All telemetry health checks passed ✓");
  }

  return recommendations;
}

/**
 * Perform comprehensive telemetry health check
 */
async function checkTelemetryHealth(): Promise<HealthMetrics> {
  console.log("=== Telemetry Health Check ===\n");

  // Determine file paths
  const snapshotDir = resolve("reports", "bot-snapshots");
  const today = new Date().toISOString().split("T")[0];
  const snapshotPath = resolve(snapshotDir, `snapshot-${today}.json`);
  const ptrStatsPath = resolve("reports", "copilot", "ptr-stats.json");

  console.log(`Checking snapshot: ${snapshotPath}`);
  console.log(`Checking PTR stats: ${ptrStatsPath}\n`);

  // Validate components
  const snapshotHealth = validateSnapshot(snapshotPath);
  const ptrStatsHealth = validatePTRStats(ptrStatsPath);
  const freshnessCheck = checkFreshness(snapshotPath, ptrStatsPath);

  // Calculate overall health
  const { health: overallHealth, successRate } = calculateOverallHealth(snapshotHealth, ptrStatsHealth, freshnessCheck);

  // Generate recommendations
  const recommendations = generateRecommendations({
    snapshotHealth,
    ptrStatsHealth,
    freshnessCheck,
    overallHealth,
    successRate
  });

  const metrics: HealthMetrics = {
    snapshotHealth,
    ptrStatsHealth,
    freshnessCheck,
    overallHealth,
    successRate,
    recommendations
  };

  // Print report
  console.log("=== Health Report ===");
  console.log(`Overall Health: ${overallHealth.toUpperCase()}`);
  console.log(`Success Rate: ${successRate.toFixed(1)}%\n`);

  console.log("Snapshot Health:");
  console.log(`  Exists: ${snapshotHealth.exists}`);
  console.log(`  Complete: ${snapshotHealth.isComplete}`);
  console.log(`  Has Game State: ${snapshotHealth.hasGameState}`);
  console.log(`  Fields: ${snapshotHealth.fields.join(", ") || "none"}`);
  if (snapshotHealth.missingFields.length > 0) {
    console.log(`  Missing: ${snapshotHealth.missingFields.join(", ")}`);
  }

  console.log("\nPTR Stats Health:");
  console.log(`  Exists: ${ptrStatsHealth.exists}`);
  console.log(`  Complete: ${ptrStatsHealth.isComplete}`);
  console.log(`  Source: ${ptrStatsHealth.source}`);
  console.log(`  Success: ${ptrStatsHealth.success}`);
  console.log(`  Fallback Activated: ${ptrStatsHealth.fallbackActivated}`);
  console.log(`  Has Stats Data: ${ptrStatsHealth.hasStats}`);

  console.log("\nFreshness:");
  if (freshnessCheck.snapshotAge !== null) {
    const minutes = Math.floor(freshnessCheck.snapshotAge / 60000);
    console.log(`  Snapshot Age: ${minutes} minutes ${freshnessCheck.snapshotStale ? "(STALE)" : "(fresh)"}`);
  } else {
    console.log(`  Snapshot Age: N/A (file missing)`);
  }

  if (freshnessCheck.ptrStatsAge !== null) {
    const minutes = Math.floor(freshnessCheck.ptrStatsAge / 60000);
    console.log(`  PTR Stats Age: ${minutes} minutes ${freshnessCheck.ptrStatsStale ? "(STALE)" : "(fresh)"}`);
  } else {
    console.log(`  PTR Stats Age: N/A (file missing)`);
  }

  console.log("\nRecommendations:");
  recommendations.forEach((rec, idx) => {
    console.log(`  ${idx + 1}. ${rec}`);
  });

  return metrics;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const metrics = await checkTelemetryHealth();

    // Exit with appropriate code based on health
    if (metrics.overallHealth === "critical") {
      console.error("\n❌ Telemetry health is CRITICAL");
      process.exit(1);
    } else if (metrics.overallHealth === "degraded") {
      console.warn("\n⚠ Telemetry health is DEGRADED");
      process.exit(0); // Don't fail workflow, just warn
    } else {
      console.log("\n✓ Telemetry health is HEALTHY");
      process.exit(0);
    }
  } catch (error) {
    console.error("Failed to check telemetry health:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { checkTelemetryHealth };
export type { HealthMetrics };
