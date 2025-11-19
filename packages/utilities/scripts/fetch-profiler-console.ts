import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { ScreepsAPI } from "screeps-api";
import {
  type ProfilerMemory,
  type ProfilerSnapshot,
  calculateProfilerSummary
} from "../../bot/src/shared/profiler-types";

interface ConsoleResponse {
  ok: number;
  data: string;
  error?: string;
}

/**
 * Configuration for retry logic
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 2000,
  backoffMultiplier: 1.5
} as const;

/**
 * Fetch Memory.profiler data from Screeps console with retry logic
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

  // Retry logic for transient failures
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        const delay = RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 2);
        console.log(`  Retry attempt ${attempt}/${RETRY_CONFIG.maxAttempts} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log(`  Sending console command to retrieve Memory.profiler...`);

      // Note: ScreepsAPI.console() returns a Promise despite typing issues in older versions
      const response = (await api.console(profilerCommand, shard)) as ConsoleResponse;

      console.log(`  Console API response received (ok: ${response.ok})`);

      if (!response.ok) {
        console.error(`❌ Console command failed`);
        console.error(`   Error: ${response.error || "Unknown error"}`);
        console.error(`   Response status: ${response.ok}`);
        console.error(`   This may indicate:`);
        console.error(`     - Invalid or expired SCREEPS_TOKEN`);
        console.error(`     - Network connectivity issues`);
        console.error(`     - Screeps server API unavailable`);
        console.error(`     - Rate limiting`);
        throw new Error(response.error || "Console command failed");
      }

      console.log(`  Parsing console response data...`);
      const result = JSON.parse(response.data) as ProfilerMemory | { error: string };

      if ("error" in result) {
        console.log(`⚠ Profiler not available: ${result.error}`);
        console.log(`  This typically means:`);
        console.log(`    - Memory.profiler is undefined (bot not deployed with profiler enabled)`);
        console.log(`    - Memory has been reset`);
        console.log(`    - Bot code hasn't executed first tick yet`);
        return null;
      }

      console.log(`✓ Profiler data fetched successfully`);
      console.log(
        `  Total ticks: ${result.total}, Functions: ${Object.keys(result.data).length}, Active: ${result.start ? "Yes" : "No"}`
      );

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Determine if error is retryable
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("ECONNRESET") ||
          error.message.includes("ETIMEDOUT") ||
          error.message.includes("ENOTFOUND") ||
          error.message.includes("429"));

      if (attempt < RETRY_CONFIG.maxAttempts && isRetryable) {
        console.warn(`  ⚠ Attempt ${attempt} failed (retryable error), will retry...`);
        console.warn(`     Error: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }

      // Non-retryable error or final attempt - log details and throw
      console.error(`❌ Failed to fetch profiler data (attempt ${attempt}/${RETRY_CONFIG.maxAttempts}):`);
      if (error instanceof Error) {
        console.error(`   Error: ${error.message}`);
        console.error(`   Error type: ${error.constructor.name}`);

        // Log response data if available (for API errors)
        const apiError = error as Error & { response?: { status?: number; data?: unknown } };
        if (apiError.response) {
          console.error(`   HTTP Status: ${apiError.response.status}`);
          console.error(`   Response data:`, apiError.response.data);
        }

        // Provide actionable error messages
        if (error.message.includes("ENOTFOUND") || error.message.includes("ECONNREFUSED")) {
          console.error(`   → Network error: Cannot reach Screeps server`);
          console.error(`   → Check SCREEPS_HOST and network connectivity`);
        } else if (error.message.includes("401") || error.message.includes("403")) {
          console.error(`   → Authentication error: Invalid or expired token`);
          console.error(`   → Check SCREEPS_TOKEN secret is valid`);
        } else if (error.message.includes("429")) {
          console.error(`   → Rate limit error: Too many requests`);
          console.error(`   → Wait before retrying`);
        }
      } else {
        console.error(`   Error: ${String(error)}`);
      }

      throw lastError;
    }
  }

  // This should never be reached due to throw in loop, but TypeScript needs it
  throw lastError || new Error("Failed to fetch profiler data after all retry attempts");
}

/**
 * Create profiler snapshot with analysis
 */
function createProfilerSnapshot(
  profilerMemory: ProfilerMemory | null,
  currentTick?: number,
  fetchError?: string
): ProfilerSnapshot {
  const snapshot: ProfilerSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "console",
    isEnabled: false,
    hasData: false
  };

  if (!profilerMemory) {
    // Provide detailed error message based on fetch error if available
    if (fetchError) {
      snapshot.error = `Profiler data fetch failed: ${fetchError}`;
    } else {
      snapshot.error =
        "Profiler not initialized in Memory - bot may not have completed first tick or profiler disabled in build";
    }
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
  let fetchError: string | undefined;
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
      console.log("  Note: Profiler is enabled by default in builds");
      console.log("  To start data collection, run in console: Profiler.start()");
    } else {
      console.log("\n⚠ Profiler is initialized but has no data");
      console.log("  Run Profiler.start() in console to begin collecting data");
    }
  } catch (error) {
    console.error("Failed to fetch profiler data:");
    fetchError = error instanceof Error ? error.message : String(error);

    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
    } else {
      console.error(`  Error: ${String(error)}`);
    }

    // Create failure snapshot with detailed error context
    const outputDir = resolve("reports", "profiler");
    mkdirSync(outputDir, { recursive: true });
    const filePath = resolve(outputDir, "latest.json");

    const failureSnapshot = createProfilerSnapshot(null, undefined, fetchError);

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

export { fetchProfilerFromConsole, createProfilerSnapshot };
