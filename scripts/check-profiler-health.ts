import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import { constants } from "node:fs";
import type { ProfilerSnapshot } from "../src/shared/profiler-types";

/**
 * Check profiler health status and report warnings/errors
 * Used in monitoring workflow to validate profiler data collection
 */

interface HealthCheckResult {
  status: "healthy" | "warning" | "error";
  message: string;
  details?: string[];
}

async function checkProfilerHealth(): Promise<HealthCheckResult> {
  const profilerPath = resolve("reports", "profiler", "latest.json");

  // Check if profiler report exists
  try {
    await access(profilerPath, constants.F_OK);
  } catch {
    return {
      status: "error",
      message: "Profiler report not found at reports/profiler/latest.json",
      details: [
        "Expected file to be created by monitoring workflow",
        "Run: npx tsx scripts/fetch-profiler-console.ts to fetch profiler data"
      ]
    };
  }

  // Read and parse profiler snapshot
  let snapshot: ProfilerSnapshot;
  try {
    const content = await readFile(profilerPath, "utf-8");
    snapshot = JSON.parse(content) as ProfilerSnapshot;
  } catch (error) {
    return {
      status: "error",
      message: "Failed to parse profiler report",
      details: [error instanceof Error ? error.message : String(error)]
    };
  }

  // Check for fetch errors
  if (snapshot.error) {
    return {
      status: "error",
      message: "Profiler data fetch failed",
      details: [snapshot.error, "Check SCREEPS_TOKEN and network connectivity"]
    };
  }

  // Check if profiler is enabled
  if (!snapshot.isEnabled) {
    return {
      status: "warning",
      message: "Profiler is not running",
      details: [
        "Profiler auto-start should have started it on first tick",
        "Run in console: Profiler.start()",
        "Or wait for next deployment"
      ]
    };
  }

  // Check if profiler has data
  if (!snapshot.hasData) {
    return {
      status: "warning",
      message: "Profiler has no data yet",
      details: [
        "Profiler is running but hasn't collected enough data",
        "Wait for 100+ ticks of profiler execution",
        "Data should appear in next monitoring cycle"
      ]
    };
  }

  // Check data freshness (within last hour)
  const fetchedAt = new Date(snapshot.fetchedAt);
  const now = new Date();
  const ageMinutes = (now.getTime() - fetchedAt.getTime()) / (1000 * 60);

  if (ageMinutes > 60) {
    return {
      status: "warning",
      message: `Profiler data is stale (${Math.floor(ageMinutes)} minutes old)`,
      details: ["Monitoring workflow may not be running on schedule", "Check workflow runs in GitHub Actions"]
    };
  }

  // All checks passed - profiler is healthy
  const summary = snapshot.summary;
  return {
    status: "healthy",
    message: "Profiler is operational",
    details: summary
      ? [
          `Total ticks: ${summary.totalTicks}`,
          `Functions profiled: ${summary.totalFunctions}`,
          `Avg CPU/tick: ${summary.averageCpuPerTick.toFixed(2)}ms`,
          `Top consumer: ${summary.topCpuConsumers[0]?.name} (${summary.topCpuConsumers[0]?.cpuPerTick.toFixed(2)}ms/tick)`
        ]
      : []
  };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("Checking profiler health...");

  const result = await checkProfilerHealth();

  console.log(`\nStatus: ${result.status.toUpperCase()}`);
  console.log(result.message);

  if (result.details && result.details.length > 0) {
    console.log("\nDetails:");
    result.details.forEach(detail => {
      console.log(`  - ${detail}`);
    });
  }

  // Exit with appropriate code
  if (result.status === "error") {
    console.error("\n❌ Profiler health check failed");
    process.exit(1);
  } else if (result.status === "warning") {
    console.warn("\n⚠️  Profiler has warnings");
    process.exit(0); // Don't fail workflow on warnings
  } else {
    console.log("\n✅ Profiler is healthy");
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error during profiler health check:", error);
    process.exit(1);
  });
}

export { checkProfilerHealth };
