import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
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
 * Archive profiler data from Screeps Memory.profiler to timestamped files.
 * This script is designed to be run periodically (e.g., every 30 minutes) by the
 * monitoring workflow to prevent unbounded Memory.profiler growth.
 *
 * The archival process:
 * 1. Fetch current Memory.profiler data via console API
 * 2. Save to timestamped file in reports/profiler/
 * 3. Clear Memory.profiler.data while preserving running state (start tick, total)
 * 4. Update latest.json for health checks
 *
 * @see https://github.com/ralphschuler/.screeps-gpt/issues/1490
 */

/**
 * Fetch Memory.profiler data from Screeps console with retry logic
 */
async function fetchProfilerFromConsole(api: ScreepsAPI, shard: string): Promise<ProfilerMemory | null> {
  // Console command to extract Memory.profiler
  const profilerCommand = `
    (function() {
      if (typeof Memory.profiler === 'undefined') {
        return JSON.stringify({ error: 'Profiler not initialized' });
      }
      return JSON.stringify(Memory.profiler);
    })()
  `.trim();

  console.log(`Fetching profiler data from shard ${shard}...`);

  // Retry logic for transient failures
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        const delay = RETRY_CONFIG.delayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 2);
        console.log(`  Retry attempt ${attempt}/${RETRY_CONFIG.maxAttempts} after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = (await api.console(profilerCommand, shard)) as ConsoleResponse;

      if (!response.ok) {
        throw new Error(response.error || "Console command failed");
      }

      const result = JSON.parse(response.data) as ProfilerMemory | { error: string };

      if ("error" in result) {
        console.log(`⚠ Profiler not available: ${result.error}`);
        return null;
      }

      console.log(
        `✓ Profiler data fetched: ${Object.keys(result.data).length} functions, ` +
          `total=${result.total} ticks, active=${result.start !== undefined}`
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
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error("Failed to fetch profiler data after all retry attempts");
}

/**
 * Clear Memory.profiler.data via console command while preserving running state.
 * This resets the data collection while keeping the profiler running.
 */
async function clearProfilerData(api: ScreepsAPI, shard: string): Promise<boolean> {
  const clearCommand = `
    (function() {
      if (typeof Memory.profiler === 'undefined') {
        return JSON.stringify({ success: false, error: 'Profiler not initialized' });
      }
      // Preserve running state (start tick and total)
      const wasRunning = Memory.profiler.start;
      const totalTicks = Memory.profiler.total;
      
      // Clear data while preserving state
      Memory.profiler.data = {};
      
      return JSON.stringify({ 
        success: true, 
        wasRunning: wasRunning !== undefined,
        totalTicks: totalTicks,
        message: 'Profiler data cleared, running state preserved'
      });
    })()
  `.trim();

  console.log(`Clearing Memory.profiler.data on shard ${shard}...`);

  try {
    const response = (await api.console(clearCommand, shard)) as ConsoleResponse;

    if (!response.ok) {
      console.error(`❌ Failed to clear profiler data: ${response.error || "Unknown error"}`);
      return false;
    }

    const result = JSON.parse(response.data) as
      | { success: true; wasRunning: boolean; totalTicks: number; message: string }
      | { success: false; error: string };

    if (!result.success) {
      console.error(`❌ Failed to clear profiler data: ${result.error}`);
      return false;
    }

    console.log(`✓ Profiler data cleared (wasRunning: ${result.wasRunning}, totalTicks: ${result.totalTicks})`);
    return true;
  } catch (error) {
    console.error(`❌ Error clearing profiler data: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Create profiler snapshot with analysis
 */
function createProfilerSnapshot(profilerMemory: ProfilerMemory | null, fetchError?: string): ProfilerSnapshot {
  const snapshot: ProfilerSnapshot = {
    fetchedAt: new Date().toISOString(),
    source: "console-archive",
    isEnabled: false,
    hasData: false
  };

  if (!profilerMemory) {
    snapshot.error = fetchError || "Profiler data not available";
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
 * Save profiler archive to timestamped file
 */
function saveProfilerArchive(snapshot: ProfilerSnapshot): string {
  const outputDir = resolve("reports", "profiler");
  mkdirSync(outputDir, { recursive: true });

  // Generate timestamp-based filename
  const timestamp = new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
  const archivePath = resolve(outputDir, `archive-${timestamp}.json`);

  // Save archive
  writeFileSync(archivePath, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Profiler archive saved to: ${archivePath}`);

  // Also update latest.json for health checks
  const latestPath = resolve(outputDir, "latest.json");
  writeFileSync(latestPath, JSON.stringify(snapshot, null, 2));
  console.log(`✓ Updated latest.json`);

  return archivePath;
}

/**
 * Update archive index with new archive entry
 */
function updateArchiveIndex(archivePath: string, snapshot: ProfilerSnapshot): void {
  const indexPath = resolve("reports", "profiler", "archive-index.json");

  interface ArchiveEntry {
    path: string;
    timestamp: string;
    functionCount: number;
    totalTicks: number;
    averageCpuPerTick: number;
  }

  interface ArchiveIndex {
    lastUpdated: string;
    archives: ArchiveEntry[];
  }

  // Load existing index or create new one
  let index: ArchiveIndex;
  if (existsSync(indexPath)) {
    try {
      index = JSON.parse(readFileSync(indexPath, "utf-8")) as ArchiveIndex;
    } catch {
      index = { lastUpdated: new Date().toISOString(), archives: [] };
    }
  } else {
    index = { lastUpdated: new Date().toISOString(), archives: [] };
  }

  // Add new archive entry
  const entry: ArchiveEntry = {
    path: archivePath.replace(resolve("reports", "profiler") + "/", ""),
    timestamp: snapshot.fetchedAt,
    functionCount: snapshot.summary?.totalFunctions || 0,
    totalTicks: snapshot.summary?.totalTicks || 0,
    averageCpuPerTick: snapshot.summary?.averageCpuPerTick || 0
  };

  index.archives.push(entry);
  index.lastUpdated = new Date().toISOString();

  // Keep only last 100 entries in index
  if (index.archives.length > 100) {
    index.archives = index.archives.slice(-100);
  }

  writeFileSync(indexPath, JSON.stringify(index, null, 2));
  console.log(`✓ Updated archive index (${index.archives.length} entries)`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const token = process.env.SCREEPS_TOKEN;
  const hostname = process.env.SCREEPS_HOST || "screeps.com";
  const protocol = process.env.SCREEPS_PROTOCOL || "https";
  const port = process.env.SCREEPS_PORT ? parseInt(process.env.SCREEPS_PORT, 10) : undefined;
  const path = process.env.SCREEPS_PATH || "/";
  const shard = process.env.SCREEPS_SHARD || "shard3";
  const skipClear = process.env.SKIP_PROFILER_CLEAR === "true";

  if (!token) {
    console.error("❌ Missing SCREEPS_TOKEN environment variable");
    process.exit(1);
  }

  console.log(`\n📊 Profiler Data Archival`);
  console.log(`   Host: ${hostname}, Shard: ${shard}`);
  console.log(`   Skip clear: ${skipClear}\n`);

  const api = new ScreepsAPI({ token, hostname, protocol, port, path });

  try {
    // Step 1: Fetch current profiler data
    const profilerMemory = await fetchProfilerFromConsole(api, shard);

    // Step 2: Create snapshot
    const snapshot = createProfilerSnapshot(profilerMemory);

    // Step 3: Save archive (only if we have data)
    if (snapshot.hasData) {
      const archivePath = saveProfilerArchive(snapshot);
      updateArchiveIndex(archivePath, snapshot);

      // Step 4: Clear profiler data (unless skipped)
      if (!skipClear) {
        const cleared = await clearProfilerData(api, shard);
        if (cleared) {
          console.log(`\n✅ Profiler data archived and cleared successfully`);
        } else {
          console.log(`\n⚠️ Profiler data archived but clear failed`);
        }
      } else {
        console.log(`\n✅ Profiler data archived (clear skipped)`);
      }

      // Print summary
      if (snapshot.summary) {
        console.log(`\n📈 Archive Summary:`);
        console.log(`   Total ticks: ${snapshot.summary.totalTicks}`);
        console.log(`   Functions: ${snapshot.summary.totalFunctions}`);
        console.log(`   Avg CPU/tick: ${snapshot.summary.averageCpuPerTick.toFixed(2)}ms`);
        if (snapshot.summary.topCpuConsumers.length > 0) {
          console.log(`\n   Top 5 CPU Consumers:`);
          snapshot.summary.topCpuConsumers.slice(0, 5).forEach((func, i) => {
            console.log(`   ${i + 1}. ${func.name}: ${func.cpuPerTick.toFixed(2)}ms/tick (${func.percentOfTotal.toFixed(1)}%)`);
          });
        }
      }
    } else {
      // Still save the snapshot for health check visibility
      saveProfilerArchive(snapshot);
      console.log(`\n⚠️ No profiler data to archive`);
      if (snapshot.error) {
        console.log(`   Reason: ${snapshot.error}`);
      }
    }
  } catch (error) {
    console.error(`\n❌ Archival failed:`);
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);

    // Save failure snapshot for visibility
    const failureSnapshot = createProfilerSnapshot(
      null,
      error instanceof Error ? error.message : String(error)
    );
    saveProfilerArchive(failureSnapshot);

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

export { fetchProfilerFromConsole, clearProfilerData, createProfilerSnapshot, saveProfilerArchive };
