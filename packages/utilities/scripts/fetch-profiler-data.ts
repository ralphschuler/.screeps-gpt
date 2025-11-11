import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  type ProfilerMemory,
  type ProfilerSnapshot,
  calculateProfilerSummary
} from "../../bot/src/shared/profiler-types";

/**
 * Fetch profiler data from Screeps Memory.profiler via console execution.
 * This script simulates console access to retrieve profiling metrics when
 * the profiler is enabled and has collected data.
 */

/**
 * Simulate fetching Memory.profiler data
 * In production, this would use screeps-mcp console command execution
 */
function fetchProfilerDataFromConsole(): ProfilerMemory | null {
  // This is a placeholder for actual console command execution
  // In the real workflow, this would use screeps-mcp tools to execute:
  // JSON.stringify(Memory.profiler)

  console.log("Note: This script requires screeps-mcp integration to fetch live profiler data");
  console.log("In CI/CD workflow, this will use console command execution via screeps-mcp");

  // Return null to indicate no data available without console access
  return null;
}

/**
 * Create a profiler snapshot with analysis
 */
function createProfilerSnapshot(profilerMemory: ProfilerMemory | null): ProfilerSnapshot {
  const snapshot: ProfilerSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "console",
    isEnabled: false,
    hasData: false
  };

  if (!profilerMemory) {
    snapshot.error = "Profiler data not available - requires console access or profiler not initialized";
    return snapshot;
  }

  snapshot.profilerMemory = profilerMemory;
  snapshot.isEnabled = profilerMemory.start !== undefined;
  snapshot.hasData = Object.keys(profilerMemory.data).length > 0;

  if (snapshot.hasData) {
    snapshot.summary = calculateProfilerSummary(profilerMemory);
  }

  return snapshot;
}

/**
 * Save profiler snapshot to reports directory
 */
function saveProfilerSnapshot(snapshot: ProfilerSnapshot): void {
  const reportsDir = resolve("reports", "profiler");
  mkdirSync(reportsDir, { recursive: true });

  const snapshotPath = resolve(reportsDir, "latest.json");
  const timestampedPath = resolve(reportsDir, `profiler-${new Date().toISOString().replace(/:/g, "-")}.json`);

  // Save as latest.json for easy access
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), "utf-8");

  // Also save timestamped version for history
  writeFileSync(timestampedPath, JSON.stringify(snapshot, null, 2), "utf-8");

  console.log(`Profiler snapshot saved to: ${snapshotPath}`);
  console.log(`Timestamped snapshot saved to: ${timestampedPath}`);
}

/**
 * Main entry point
 */
function main(): void {
  console.log("Fetching profiler data from Screeps Memory...");

  const profilerMemory = fetchProfilerDataFromConsole();
  const snapshot = createProfilerSnapshot(profilerMemory);

  saveProfilerSnapshot(snapshot);

  // Print summary
  if (snapshot.hasData && snapshot.summary) {
    console.log("\nProfiler Summary:");
    console.log(`- Total ticks profiled: ${snapshot.summary.totalTicks}`);
    console.log(`- Functions profiled: ${snapshot.summary.totalFunctions}`);
    console.log(`- Average CPU per tick: ${snapshot.summary.averageCpuPerTick.toFixed(2)}ms`);
    console.log("\nTop CPU Consumers:");
    snapshot.summary.topCpuConsumers.slice(0, 5).forEach((func, i) => {
      console.log(
        `  ${i + 1}. ${func.name}: ${func.cpuPerTick.toFixed(2)}ms/tick (${func.percentOfTotal.toFixed(1)}%)`
      );
    });
  } else if (snapshot.error) {
    console.log(`\nProfiler Status: ${snapshot.error}`);
  } else {
    console.log("\nProfiler is initialized but has no data yet");
    console.log("Run Profiler.start() in the Screeps console to begin collecting data");
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error("Failed to fetch profiler data:", error);
    process.exit(1);
  }
}

export { fetchProfilerDataFromConsole, createProfilerSnapshot };
