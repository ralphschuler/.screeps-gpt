import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

interface TelemetrySnapshot {
  fetchedAt: string;
  endpoint: string;
  source?: string;
  status?: string;
  failureType?: string;
  payload?: {
    ok: number;
    stats: Record<string, unknown>;
  };
}

interface HealthCheckResult {
  healthy: boolean;
  availability: number;
  issues: string[];
  warnings: string[];
  recommendations: string[];
  dataSource?: string;
  lastUpdate?: string;
}

/**
 * Validate telemetry health based on latest snapshot
 * Detects empty stats data and provides diagnostic information
 */
function validateTelemetryHealth(): HealthCheckResult {
  const result: HealthCheckResult = {
    healthy: true,
    availability: 100,
    issues: [],
    warnings: [],
    recommendations: []
  };

  const snapshotPath = resolve("reports", "screeps-stats", "latest.json");

  // Check if snapshot exists
  if (!existsSync(snapshotPath)) {
    result.healthy = false;
    result.availability = 0;
    result.issues.push("Telemetry snapshot not found");
    result.recommendations.push("Run fetch-resilient-telemetry.ts to collect telemetry data");
    return result;
  }

  // Read and parse snapshot
  let snapshot: TelemetrySnapshot;
  try {
    const content = readFileSync(snapshotPath, "utf-8");
    snapshot = JSON.parse(content);
    result.lastUpdate = snapshot.fetchedAt;
    result.dataSource = snapshot.source || "stats_api";
  } catch (error) {
    result.healthy = false;
    result.availability = 0;
    result.issues.push(`Failed to parse telemetry snapshot: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  // Check for failure status
  if (snapshot.status === "api_unavailable" || snapshot.status === "console_unavailable") {
    result.healthy = false;
    result.availability = 0;
    result.issues.push(`Telemetry source unavailable: ${snapshot.status}`);
    result.issues.push(`Failure type: ${snapshot.failureType || "unknown"}`);
    result.recommendations.push("Verify SCREEPS_TOKEN is valid and has proper permissions");
    result.recommendations.push("Check Screeps API infrastructure status at https://screeps.com");
    return result;
  }

  if (snapshot.status === "all_sources_unavailable") {
    result.healthy = false;
    result.availability = 0;
    result.issues.push("All telemetry sources failed (both Stats API and Console)");
    result.recommendations.push("CRITICAL: Verify Screeps credentials and connectivity");
    result.recommendations.push("Check network connectivity to Screeps servers");
    result.recommendations.push("Validate SCREEPS_TOKEN environment variable");
    return result;
  }

  // Check for empty stats data (the regression issue)
  if (snapshot.payload) {
    if (snapshot.payload.ok !== 1) {
      result.healthy = false;
      result.availability = 0;
      result.issues.push(`Stats API returned error response (ok=${snapshot.payload.ok})`);
      return result;
    }

    const stats = snapshot.payload.stats;
    const statsKeys = Object.keys(stats);

    // Empty stats object - the critical regression
    if (statsKeys.length === 0) {
      result.healthy = false;
      result.availability = 0;
      result.issues.push("CRITICAL: Stats API returned empty stats data (telemetry blackout)");
      result.issues.push("Memory.stats is not being synced to /api/user/stats endpoint");
      result.recommendations.push("Verify bot is running and Memory.stats is being populated");
      result.recommendations.push("Check if bot experienced respawn or memory reset");
      result.recommendations.push("Review StatsCollector integration in kernel bootstrap");
      result.recommendations.push("Consider using console fallback telemetry as temporary workaround");
      return result;
    }

    // Check if stats data is recent using the snapshot's fetchedAt timestamp
    let ageHours: number | null = null;
    if (snapshot.fetchedAt) {
      const fetchedAtTime = Date.parse(snapshot.fetchedAt);
      if (!isNaN(fetchedAtTime)) {
        const now = Date.now();
        const ageMs = now - fetchedAtTime;
        ageHours = ageMs / (1000 * 60 * 60);
      }
    }

    if (ageHours !== null && ageHours > 6) {
      result.warnings.push(`Latest stats data is ${ageHours.toFixed(1)} hours old (stale data)`);
      result.recommendations.push("Bot may not be actively running or stats sync is delayed");
      result.availability = 50; // Partial availability
    }

    // Check if stats contain expected fields
    // Find the latest tick in the stats object
    const ticks = statsKeys.map(key => parseInt(key, 10)).filter(tick => !isNaN(tick));
    if (ticks.length > 0) {
      const latestTick = Math.max(...ticks);
      const latestStats = stats[latestTick.toString()];
      if (typeof latestStats === "object" && latestStats !== null) {
        const hasExpectedFields = "cpu" in latestStats && "rooms" in latestStats && "creeps" in latestStats;

        if (!hasExpectedFields) {
          result.warnings.push("Stats data missing expected fields (cpu, rooms, creeps)");
          result.recommendations.push("Verify StatsCollector is collecting all required metrics (cpu, rooms, creeps)");
          result.availability = 75; // Mostly available but incomplete
        }
      }
    }
  }

  // Check for fallback activation
  if (snapshot.source === "console") {
    result.warnings.push("Console fallback activated - Stats API was unavailable");
    result.recommendations.push("Monitor Stats API availability and investigate recurring failures");
    result.availability = 80; // Working but using fallback
  }

  return result;
}

/**
 * Main entry point
 */
function main(): void {
  console.log("=== Telemetry Health Validation ===\n");

  const health = validateTelemetryHealth();

  console.log(`Health Status: ${health.healthy ? "✓ HEALTHY" : "✗ UNHEALTHY"}`);
  console.log(`Availability: ${health.availability}%`);

  if (health.dataSource) {
    console.log(`Data Source: ${health.dataSource}`);
  }

  if (health.lastUpdate) {
    console.log(`Last Update: ${health.lastUpdate}`);
  }

  if (health.issues.length > 0) {
    console.log("\n❌ Critical Issues:");
    health.issues.forEach(issue => console.log(`  - ${issue}`));
  }

  if (health.warnings.length > 0) {
    console.log("\n⚠ Warnings:");
    health.warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (health.recommendations.length > 0) {
    console.log("\n💡 Recommendations:");
    health.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }

  console.log("\n=== Validation Complete ===");

  // Exit with error code if unhealthy
  if (!health.healthy || health.availability < 90) {
    console.error("\n🚨 Telemetry health check FAILED - availability below threshold (90% required)");
    process.exit(1);
  }

  console.log("\n✅ Telemetry health check PASSED");
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateTelemetryHealth };
export type { HealthCheckResult, TelemetrySnapshot };
