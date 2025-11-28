import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

interface TelemetryResult {
  success: boolean;
  source: "stats_api" | "console" | "none";
  error?: string;
  shard?: string;
}

/**
 * Execute a script and capture its output
 */
async function executeScript(
  scriptPath: string,
  env?: Record<string, string>
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("npx", ["tsx", scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", exitCode => {
      resolve({ exitCode: exitCode || 0, stdout, stderr });
    });

    proc.on("error", error => {
      reject(error);
    });
  });
}

/**
 * Fetch telemetry with resilient fallback strategy
 *
 * Strategy:
 * 0. Fetch profiler data for CPU analysis (parallel, non-blocking)
 * 1. Try Stats API first (primary source, historical data)
 * 2. If Stats API fails, fall back to console telemetry (redundant source, real-time data)
 * 3. If both fail, create comprehensive failure snapshot
 *
 * @param shard - Optional shard to collect from. If not provided, uses SCREEPS_SHARD environment variable.
 */
async function fetchResilientTelemetry(shard?: string): Promise<TelemetryResult> {
  const targetShard = shard || process.env.SCREEPS_SHARD || "shard3";
  const shardEnv = shard ? { SCREEPS_SHARD: shard } : undefined;

  console.log("=== Resilient Telemetry Collection ===");
  console.log(`Target shard: ${targetShard}`);
  console.log("Strategy: Profiler Fetch → Stats API → Console Fallback → Failure Snapshot\n");

  // Phase 0: Fetch profiler data for CPU analysis (non-blocking)
  console.log("Phase 0: Fetching profiler data for CPU analysis...");
  try {
    const profilerResult = await executeScript("packages/utilities/scripts/fetch-profiler-console.ts", shardEnv);

    if (profilerResult.exitCode === 0) {
      console.log("✓ Profiler data fetch successful");
      console.log(profilerResult.stdout);
    } else {
      console.log("⚠ Profiler data fetch failed (may not be initialized yet)");
      console.log(profilerResult.stderr);
    }
  } catch (error) {
    console.log("⚠ Profiler data fetch failed with exception (non-critical):", error);
  }

  console.log();

  // Phase 1: Try Stats API
  console.log("Phase 1: Attempting Stats API telemetry...");
  try {
    const statsResult = await executeScript("packages/utilities/scripts/fetch-screeps-stats.mjs", shardEnv);

    if (statsResult.exitCode === 0) {
      console.log("✓ Stats API telemetry successful");
      console.log(statsResult.stdout);
      return { success: true, source: "stats_api", shard: targetShard };
    }

    console.log("✗ Stats API telemetry failed (exit code: " + statsResult.exitCode + ")");
    console.log("Stats API stderr:", statsResult.stderr);
  } catch (error) {
    console.log("✗ Stats API telemetry failed with exception:", error);
  }

  // Phase 2: Fall back to Console Telemetry
  console.log("\nPhase 2: Falling back to Console telemetry...");
  try {
    const consoleResult = await executeScript("packages/utilities/scripts/fetch-console-telemetry.ts", shardEnv);

    if (consoleResult.exitCode === 0) {
      console.log("✓ Console telemetry successful (fallback activated)");
      console.log(consoleResult.stdout);

      // Add metadata indicating this is fallback data
      const outputDir = resolve("reports", "screeps-stats");
      const filePath = resolve(outputDir, "latest.json");
      const fs = await import("node:fs/promises");
      const content = await fs.readFile(filePath, "utf-8");
      const snapshot = JSON.parse(content);
      snapshot.fallback_activated = true;
      snapshot.primary_source_failed = true;
      snapshot.shard = targetShard;
      await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2));

      return { success: true, source: "console", shard: targetShard };
    }

    console.log("✗ Console telemetry failed (exit code: " + consoleResult.exitCode + ")");
    console.log("Console stderr:", consoleResult.stderr);
  } catch (error) {
    console.log("✗ Console telemetry failed with exception:", error);
  }

  // Phase 3: Both sources failed - create comprehensive failure snapshot
  console.log("\nPhase 3: Both telemetry sources failed - creating failure snapshot");

  const outputDir = resolve("reports", "screeps-stats");
  mkdirSync(outputDir, { recursive: true });
  const filePath = resolve(outputDir, "latest.json");

  const failureSnapshot = {
    status: "all_sources_unavailable",
    failureType: "infrastructure_failure",
    timestamp: new Date().toISOString(),
    shard: targetShard,
    error: "Both Stats API and Console telemetry sources failed",
    attempted_sources: ["stats_api", "console"],
    resilience_status: "critical",
    recommendation: "Verify Screeps credentials (SCREEPS_TOKEN) and connectivity. Check Screeps infrastructure status."
  };

  writeFileSync(filePath, JSON.stringify(failureSnapshot, null, 2));
  console.error("⚠ Comprehensive failure snapshot saved to:", filePath);

  return { success: false, source: "none", error: "All telemetry sources failed", shard: targetShard };
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const result = await fetchResilientTelemetry();

  console.log("\n=== Telemetry Collection Result ===");
  console.log(`Success: ${result.success}`);
  console.log(`Source: ${result.source}`);

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  // Exit with success code 0 even if using fallback
  // The monitoring system will check the snapshot metadata
  process.exit(0);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { fetchResilientTelemetry };
export type { TelemetryResult };
