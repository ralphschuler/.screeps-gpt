import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fetchResilientTelemetry } from "./fetch-resilient-telemetry.js";
import { discoverBotShards, type ShardInfo } from "./lib/shard-discovery.js";

interface PTRStatsMetadata {
  collectedAt: string;
  source: "stats_api" | "console" | "none";
  success: boolean;
  error?: string;
  fallbackActivated: boolean;
  shards?: string[];
  totalRooms?: number;
}

interface ShardStats {
  shard: string;
  source: "stats_api" | "console" | "none";
  success: boolean;
  stats: Record<string, unknown> | null;
  error?: string;
  rooms?: string[];
}

interface PTRStats {
  metadata: PTRStatsMetadata;
  stats: Record<string, unknown> | null;
  shardStats?: ShardStats[];
  raw?: unknown;
}

/**
 * Collect stats for a single shard
 */
async function collectShardStats(shardInfo: ShardInfo): Promise<ShardStats> {
  console.log(`\n--- Collecting stats from ${shardInfo.name} (${shardInfo.rooms.length} rooms) ---`);

  try {
    // Use resilient telemetry collection for this shard
    const result = await fetchResilientTelemetry(shardInfo.name);

    // Read the generated stats file
    const statsPath = resolve("reports", "screeps-stats", "latest.json");
    let statsContent: Record<string, unknown> | null = null;
    let source: "stats_api" | "console" | "none" = result.source;

    try {
      const statsData = readFileSync(statsPath, "utf-8");
      const parsed = JSON.parse(statsData);

      // Check if this is a fallback or failure response
      if (parsed.status === "all_sources_unavailable") {
        statsContent = null;
        source = "none";
      } else if (parsed.fallback_activated || parsed.source === "console") {
        statsContent = parsed.payload?.stats || parsed;
        source = "console";
      } else if (parsed.payload?.stats) {
        statsContent = parsed.payload.stats;
        source = "stats_api";
      } else {
        statsContent = parsed;
      }
    } catch (readError) {
      console.warn(`Failed to read stats file for ${shardInfo.name}:`, readError);
      statsContent = null;
      source = "none";
    }

    return {
      shard: shardInfo.name,
      source,
      success: result.success,
      stats: statsContent,
      error: result.error,
      rooms: shardInfo.rooms
    };
  } catch (error) {
    console.error(`Failed to collect stats for ${shardInfo.name}:`, error);
    return {
      shard: shardInfo.name,
      source: "none",
      success: false,
      stats: null,
      error: error instanceof Error ? error.message : String(error),
      rooms: shardInfo.rooms
    };
  }
}

/**
 * Aggregate stats from multiple shards into a combined view
 */
function aggregateStats(shardStats: ShardStats[]): Record<string, unknown> | null {
  const successfulStats = shardStats.filter(s => s.success && s.stats);

  if (successfulStats.length === 0) {
    return null;
  }

  // For now, merge stats by shard key
  const aggregated: Record<string, unknown> = {};

  for (const shardStat of successfulStats) {
    if (shardStat.stats) {
      aggregated[shardStat.shard] = shardStat.stats;
    }
  }

  return aggregated;
}

/**
 * Collect PTR stats with multi-source fallback and multi-shard support
 *
 * This script orchestrates the resilient telemetry collection across all discovered
 * shards and saves the results to the expected location for PTR monitoring and analysis.
 */
async function collectPTRStats(): Promise<void> {
  console.log("=== PTR Stats Collection (Multi-Shard) ===");
  console.log("Discovering shards and collecting telemetry...\n");

  const collectedAt = new Date().toISOString();

  try {
    // Phase 1: Discover all shards where bot has rooms
    console.log("Phase 1: Discovering bot shards...");
    const shardDiscovery = await discoverBotShards();

    console.log(
      `\nDiscovered ${shardDiscovery.shards.length} shard(s) with ${shardDiscovery.totalRooms} total room(s)`
    );

    // Phase 2: Collect stats from each shard
    console.log("\nPhase 2: Collecting stats from each shard...");
    const shardStats: ShardStats[] = [];

    for (const shardInfo of shardDiscovery.shards) {
      const stats = await collectShardStats(shardInfo);
      shardStats.push(stats);
    }

    // Phase 3: Aggregate and save results
    console.log("\nPhase 3: Aggregating and saving results...");

    const successfulShards = shardStats.filter(s => s.success);
    const failedShards = shardStats.filter(s => !s.success);
    const overallSuccess = successfulShards.length > 0;
    const aggregatedStats = aggregateStats(shardStats);

    // Determine overall source (prefer stats_api, then console, then none)
    let overallSource: "stats_api" | "console" | "none" = "none";
    if (shardStats.some(s => s.source === "stats_api")) {
      overallSource = "stats_api";
    } else if (shardStats.some(s => s.source === "console")) {
      overallSource = "console";
    }

    const fallbackActivated = shardStats.some(s => s.source === "console");

    // Create PTR stats object with metadata
    const ptrStats: PTRStats = {
      metadata: {
        collectedAt,
        source: overallSource,
        success: overallSuccess,
        error: failedShards.length > 0 ? `${failedShards.length} shard(s) failed` : undefined,
        fallbackActivated,
        shards: shardDiscovery.shards.map(s => s.name),
        totalRooms: shardDiscovery.totalRooms
      },
      stats: aggregatedStats,
      shardStats,
      raw: aggregatedStats ? undefined : { reason: "No data available from any shard" }
    };

    // Save to PTR stats location
    const outputDir = resolve("reports", "copilot");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "ptr-stats.json");
    writeFileSync(outputPath, JSON.stringify(ptrStats, null, 2));

    console.log(`\n✓ PTR stats saved to: ${outputPath}`);
    console.log(`  Shards: ${shardDiscovery.shards.map(s => s.name).join(", ")}`);
    console.log(`  Total rooms: ${shardDiscovery.totalRooms}`);
    console.log(`  Successful: ${successfulShards.length}/${shardStats.length}`);
    console.log(`  Source: ${overallSource}`);
    console.log(`  Fallback activated: ${fallbackActivated}`);

    if (!overallSuccess) {
      console.error(`\n⚠ Collection failed: No data collected from any shard`);
      process.exit(1);
    }

    if (failedShards.length > 0) {
      console.warn(`\n⚠ ${failedShards.length} shard(s) failed to collect:`);
      for (const failed of failedShards) {
        console.warn(`   - ${failed.shard}: ${failed.error || "Unknown error"}`);
      }
    }
  } catch (error) {
    console.error("\n❌ Failed to collect PTR stats:");
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
    } else {
      console.error(`   Error: ${String(error)}`);
    }

    // Create failure PTR stats
    const outputDir = resolve("reports", "copilot");
    mkdirSync(outputDir, { recursive: true });
    const outputPath = resolve(outputDir, "ptr-stats.json");

    const failurePtrStats: PTRStats = {
      metadata: {
        collectedAt,
        source: "none",
        success: false,
        error: error instanceof Error ? error.message : String(error),
        fallbackActivated: false
      },
      stats: null,
      raw: { error: error instanceof Error ? error.message : String(error) }
    };

    writeFileSync(outputPath, JSON.stringify(failurePtrStats, null, 2));
    console.error(`\n⚠ Failure PTR stats saved to: ${outputPath}`);

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  collectPTRStats().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { collectPTRStats };
