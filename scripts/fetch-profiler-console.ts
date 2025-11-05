import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { ScreepsAPI } from "screeps-api";
import type { ProfilerMemory, ProfilerSnapshot } from "../src/shared/profiler-types";

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

/**
 * Fetch Memory.profiler data from Screeps console
 */
async function fetchProfilerFromConsole(): Promise<ProfilerMemory | null> {
  const token = process.env.SCREEPS_TOKEN;
  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT, 10) : undefined;
  const path = process.env.SCREEPS_PATH || "/";
  const shard = process.env.SCREEPS_SHARD || "shard3";

  if (!token) {
    throw new Error("Missing SCREEPS_TOKEN environment variable");
  }

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  // Console command to extract Memory.profiler
  const profilerCommand = `
    (function() {
      if (typeof Memory.profiler === 'undefined') {
        return JSON.stringify({ error: 'Profiler not initialized' });
      }
      return JSON.stringify(Memory.profiler);
    })()
  `.trim();

  console.log(`Fetching profiler data from ${hostname} shard ${shard}...`);

  try {
    // Note: ScreepsAPI.console() returns a Promise despite typing issues in older versions
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const response = (await api.console(profilerCommand, shard)) as ConsoleResponse;

    if (!response.ok) {
      throw new Error(response.error || "Console command failed");
    }

    const result = JSON.parse(response.data) as ProfilerMemory | { error: string };

    if ("error" in result) {
      console.log(`⚠ Profiler not available: ${result.error}`);
      return null;
    }

    console.log(`✓ Profiler data fetched successfully`);
    console.log(
      `  Total ticks: ${result.total}, Functions: ${Object.keys(result.data).length}, Active: ${result.start ? "Yes" : "No"}`
    );

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch profiler data: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Calculate profiler summary metrics
 */
function calculateProfilerSummary(profilerMemory: ProfilerMemory, currentTick?: number): ProfilerSnapshot["summary"] {
  let totalTicks = profilerMemory.total;

  // If profiler is currently running and we have current tick, use it
  if (profilerMemory.start && currentTick) {
    totalTicks += currentTick - profilerMemory.start;
  }

  // Calculate average CPU per tick
  let totalCpu = 0;
  const functions: Array<{
    name: string;
    calls: number;
    cpuPerCall: number;
    callsPerTick: number;
    cpuPerTick: number;
  }> = [];

  for (const [name, data] of Object.entries(profilerMemory.data)) {
    const cpuPerCall = data.time / data.calls;
    const callsPerTick = data.calls / totalTicks;
    const cpuPerTick = data.time / totalTicks;

    totalCpu += cpuPerTick;

    functions.push({
      name,
      calls: data.calls,
      cpuPerCall,
      callsPerTick,
      cpuPerTick
    });
  }

  // Sort by CPU per tick (descending)
  functions.sort((a, b) => b.cpuPerTick - a.cpuPerTick);

  // Take top 20 CPU consumers and add percentage
  const topCpuConsumers = functions.slice(0, 20).map(func => ({
    ...func,
    percentOfTotal: totalCpu > 0 ? (func.cpuPerTick / totalCpu) * 100 : 0
  }));

  return {
    totalTicks,
    totalFunctions: functions.length,
    averageCpuPerTick: totalCpu,
    topCpuConsumers
  };
}

/**
 * Create profiler snapshot with analysis
 */
function createProfilerSnapshot(profilerMemory: ProfilerMemory | null, currentTick?: number): ProfilerSnapshot {
  const snapshot: ProfilerSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "console",
    isEnabled: false,
    hasData: false
  };

  if (!profilerMemory) {
    snapshot.error = "Profiler not initialized in Memory";
    return snapshot;
  }

  snapshot.profilerMemory = profilerMemory;
  snapshot.isEnabled = profilerMemory.start !== undefined;
  snapshot.hasData = Object.keys(profilerMemory.data).length > 0;

  if (snapshot.hasData) {
    snapshot.summary = calculateProfilerSummary(profilerMemory, currentTick);
  }

  return snapshot;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const profilerMemory = await fetchProfilerFromConsole();
    const snapshot = createProfilerSnapshot(profilerMemory);

    // Save to reports directory
    const outputDir = resolve("reports", "profiler");
    mkdirSync(outputDir, { recursive: true });
    const filePath = resolve(outputDir, "latest.json");
    writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

    console.log(`✓ Profiler snapshot saved to: ${filePath}`);

    // Print summary
    if (snapshot.hasData && snapshot.summary) {
      console.log("\nProfiler Summary:");
      console.log(`  Total ticks profiled: ${snapshot.summary.totalTicks}`);
      console.log(`  Functions profiled: ${snapshot.summary.totalFunctions}`);
      console.log(`  Average CPU per tick: ${snapshot.summary.averageCpuPerTick.toFixed(2)}ms`);
      console.log("\n  Top 5 CPU Consumers:");
      snapshot.summary.topCpuConsumers.slice(0, 5).forEach((func, i) => {
        console.log(
          `    ${i + 1}. ${func.name}: ${func.cpuPerTick.toFixed(2)}ms/tick (${func.percentOfTotal.toFixed(1)}%)`
        );
      });
    } else if (snapshot.error) {
      console.log(`\n⚠ ${snapshot.error}`);
      console.log("  To enable profiler:");
      console.log("  1. Deploy with: PROFILER_ENABLED=true bun run deploy");
      console.log("  2. Run in console: Profiler.start()");
    } else {
      console.log("\n⚠ Profiler is initialized but has no data");
      console.log("  Run Profiler.start() in console to begin collecting data");
    }
  } catch (error) {
    console.error("Failed to fetch profiler data:");
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
    } else {
      console.error(`  Error: ${String(error)}`);
    }

    // Create failure snapshot
    const outputDir = resolve("reports", "profiler");
    mkdirSync(outputDir, { recursive: true });
    const filePath = resolve(outputDir, "latest.json");

    const failureSnapshot: ProfilerSnapshot = {
      fetchedAt: new Date().toISOString(),
      source: "console",
      isEnabled: false,
      hasData: false,
      error: error instanceof Error ? error.message : String(error)
    };

    writeFileSync(filePath, JSON.stringify(failureSnapshot, null, 2));
    console.error(`⚠ Failure snapshot saved to: ${filePath}`);

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

export { fetchProfilerFromConsole, createProfilerSnapshot, calculateProfilerSummary };
export type { ProfilerSnapshot, ProfilerMemory };
