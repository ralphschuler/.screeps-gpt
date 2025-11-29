import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BotSnapshot } from "./types/bot-snapshot";
import { fetchConsoleTelemetry } from "./fetch-console-telemetry";
import { discoverBotShards, type ShardDiscoveryResult } from "./lib/shard-discovery";

const SNAPSHOTS_DIR = resolve("reports", "bot-snapshots");
const MAX_SNAPSHOTS = 30; // Keep last 30 days of snapshots

/**
 * Clean up old snapshots, keeping only the most recent MAX_SNAPSHOTS
 */
function cleanupOldSnapshots(): void {
  try {
    const files = readdirSync(SNAPSHOTS_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => ({
        name: f,
        path: resolve(SNAPSHOTS_DIR, f),
        mtime: statSync(resolve(SNAPSHOTS_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Remove files beyond MAX_SNAPSHOTS
    if (files.length > MAX_SNAPSHOTS) {
      const toDelete = files.slice(MAX_SNAPSHOTS);
      toDelete.forEach(file => {
        console.log(`  Removing old snapshot: ${file.name}`);
        unlinkSync(file.path);
      });
    }
  } catch (error) {
    console.warn("Failed to cleanup old snapshots:", error);
  }
}

/**
 * Extract a numeric field from room data, trying primary key first, then fallback key
 * @param data - Room data object
 * @param primaryKey - Primary field name to try first
 * @param fallbackKey - Fallback field name if primary is undefined
 * @param defaultValue - Default value if both keys are undefined
 * @returns Numeric value or default
 */
function extractNumericField(
  data: Record<string, unknown>,
  primaryKey: string,
  fallbackKey: string,
  defaultValue: number
): number {
  if (data[primaryKey] !== undefined) {
    const value = Number(data[primaryKey]);
    if (isNaN(value)) {
      console.warn(`extractNumericField: Value for key '${primaryKey}' is not a valid number:`, data[primaryKey]);
      return defaultValue;
    }
    return value;
  }
  if (data[fallbackKey] !== undefined) {
    const value = Number(data[fallbackKey]);
    if (isNaN(value)) {
      console.warn(
        `extractNumericField: Value for fallback key '${fallbackKey}' is not a valid number:`,
        data[fallbackKey]
      );
      return defaultValue;
    }
    return value;
  }
  return defaultValue;
}

/**
 * Check if snapshot has meaningful data (more than just timestamp)
 */
function hasSubstantiveData(snapshot: BotSnapshot): boolean {
  return !!(snapshot.cpu || snapshot.rooms || snapshot.creeps || snapshot.spawns || snapshot.tick);
}

/**
 * Validate snapshot data quality
 * Returns validation errors if data appears stale or invalid
 */
function validateSnapshotQuality(snapshot: BotSnapshot, previousSnapshot?: BotSnapshot): string[] {
  const errors: string[] = [];
  
  // Check 1: Snapshot must have substantive data
  if (!hasSubstantiveData(snapshot)) {
    errors.push("Snapshot contains no substantive data (only timestamp)");
    return errors; // Fatal error, no point checking further
  }
  
  // Check 2: If rooms are claimed, creep count should be > 0 (after initial spawn period)
  const roomCount = Object.keys(snapshot.rooms || {}).length;
  const creepCount = snapshot.creeps?.total || 0;
  if (roomCount > 0 && creepCount === 0) {
    errors.push(`CRITICAL: ${roomCount} room(s) claimed but 0 creeps detected - possible spawn failure or data staleness`);
  }
  
  // Check 3: CPU data should be reasonable
  if (snapshot.cpu) {
    if (snapshot.cpu.used === 0 && snapshot.cpu.limit === 0 && snapshot.cpu.bucket === 0) {
      errors.push("CPU metrics are all zero - data may be stale or bot is not running");
    }
    if (snapshot.cpu.bucket < 100) {
      errors.push(`WARNING: CPU bucket critically low (${snapshot.cpu.bucket}) - bot may be in CPU crisis`);
    }
  }
  
  // Check 4: Compare with previous snapshot for staleness detection
  if (previousSnapshot && hasSubstantiveData(previousSnapshot)) {
    // Check if data is identical (indicating no updates)
    const currentRooms = JSON.stringify(snapshot.rooms);
    const previousRooms = JSON.stringify(previousSnapshot.rooms);
    const currentCreeps = JSON.stringify(snapshot.creeps);
    const previousCreeps = JSON.stringify(previousSnapshot.creeps);
    
    if (currentRooms === previousRooms && currentCreeps === previousCreeps) {
      // Data is identical - check if enough time has passed to warrant concern
      const timeDiff = new Date(snapshot.timestamp).getTime() - new Date(previousSnapshot.timestamp).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      if (hoursDiff > 12) {
        errors.push(`Data appears stale: identical to snapshot from ${hoursDiff.toFixed(1)} hours ago`);
      }
    }
  }
  
  // Check 5: Shard discovery should find rooms
  if (snapshot.shards && snapshot.shards.length > 0) {
    const discoveredRooms = snapshot.shards.reduce((sum, s) => sum + s.rooms.length, 0);
    if (discoveredRooms === 0 && roomCount > 0) {
      errors.push(`WARNING: Shard discovery found 0 rooms but snapshot has ${roomCount} room(s) - discovery may be incomplete`);
    }
  }
  
  return errors;
}

/**
 * Collect bot state snapshot from Screeps stats with multi-shard support
 */
async function collectBotSnapshot(): Promise<void> {
  console.log("Collecting bot state snapshot...\n");

  // Create snapshots directory
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  // Phase 1: Discover all shards where bot has rooms
  console.log("Phase 1: Discovering bot shards...");
  let shardDiscovery: ShardDiscoveryResult;
  try {
    shardDiscovery = await discoverBotShards();
    console.log(
      `Discovered ${shardDiscovery.shards.length} shard(s) with ${shardDiscovery.totalRooms} total room(s)\n`
    );
  } catch (error) {
    console.warn("Shard discovery failed, using default shard:", error);
    shardDiscovery = {
      shards: [{ name: process.env.SCREEPS_SHARD || "shard3", rooms: [] }],
      totalRooms: 0,
      discoveredAt: new Date().toISOString()
    };
  }

  // Try to read the latest stats from screeps-stats
  const statsPath = resolve("reports", "screeps-stats", "latest.json");
  let statsData: { payload?: { stats?: Record<string, unknown> } } | null = null;

  try {
    const statsContent = readFileSync(statsPath, "utf-8");
    statsData = JSON.parse(statsContent);
  } catch {
    console.warn("Failed to read Screeps stats, will attempt console fallback");
  }

  const timestamp = new Date().toISOString();
  const snapshot: BotSnapshot = {
    timestamp,
    // Add shard metadata
    shards: shardDiscovery.shards.map(s => ({ name: s.name, rooms: s.rooms })),
    totalRooms: shardDiscovery.totalRooms
  };

  // Extract data from stats if available
  if (statsData && statsData.payload && statsData.payload.stats) {
    const stats = statsData.payload.stats;

    // Get the most recent stats entry
    const statKeys = Object.keys(stats).sort().reverse();
    if (statKeys.length > 0) {
      const latestStats = stats[statKeys[0]] as Record<string, unknown>;

      if (latestStats) {
        // Extract CPU data
        if (latestStats.cpu !== undefined) {
          snapshot.cpu = {
            used: Number(latestStats.cpu) || 0,
            limit: Number(latestStats.cpuLimit) || 0,
            bucket: Number(latestStats.bucket) || 0
          };
        }

        // Extract tick
        if (latestStats.tick !== undefined) {
          const tick = Number(latestStats.tick);
          snapshot.tick = Number.isFinite(tick) ? tick : undefined;
        }

        // Extract room data
        if (latestStats.rooms) {
          snapshot.rooms = {};
          for (const [roomName, roomData] of Object.entries(
            latestStats.rooms as Record<string, Record<string, unknown>>
          )) {
            // Some stats sources use different field names for the same value due to API changes or legacy formats.
            // We prefer the modern field name, but fall back to the legacy/alternative if needed.
            // - "rcl" (preferred) or "controllerLevel" (legacy)
            // - "energy" (preferred) or "energyAvailable" (legacy)
            // - "energyCapacity" (preferred) or "energyCapacityAvailable" (legacy)
            const rcl = extractNumericField(roomData, "rcl", "controllerLevel", 0);
            const energy = extractNumericField(roomData, "energy", "energyAvailable", 0);
            const energyCapacity = extractNumericField(roomData, "energyCapacity", "energyCapacityAvailable", 0);

            const controllerProgress = roomData.controllerProgress ? Number(roomData.controllerProgress) : undefined;
            const controllerProgressTotal = roomData.controllerProgressTotal
              ? Number(roomData.controllerProgressTotal)
              : undefined;
            const ticksToDowngrade = roomData.ticksToDowngrade ? Number(roomData.ticksToDowngrade) : undefined;

            snapshot.rooms[roomName] = {
              rcl,
              energy,
              energyCapacity,
              controllerProgress:
                controllerProgress !== undefined && Number.isFinite(controllerProgress)
                  ? controllerProgress
                  : undefined,
              controllerProgressTotal:
                controllerProgressTotal !== undefined && Number.isFinite(controllerProgressTotal)
                  ? controllerProgressTotal
                  : undefined,
              ticksToDowngrade:
                ticksToDowngrade !== undefined && Number.isFinite(ticksToDowngrade) ? ticksToDowngrade : undefined
            };
          }
        }

        // Extract creep data
        if (latestStats.creeps !== undefined) {
          const creepsData = latestStats.creeps as { count?: number; byRole?: Record<string, number> };
          snapshot.creeps = {
            total: Number(creepsData.count || latestStats.creeps) || 0,
            byRole: creepsData.byRole
          };
        }

        // Extract memory usage
        if (latestStats.memory !== undefined) {
          const memoryData = latestStats.memory as { used?: number };
          if (memoryData.used !== undefined) {
            const used = Number(memoryData.used) || 0;
            snapshot.memory = {
              used,
              usedPercent: used > 0 ? Number(((used / (2048 * 1024)) * 100).toFixed(2)) : 0
            };
          }
        }

        // Extract structure counts
        if (latestStats.structures !== undefined) {
          const structuresData = latestStats.structures as {
            spawns?: number;
            extensions?: number;
            containers?: number;
            towers?: number;
            roads?: number;
          };
          snapshot.structures = {
            spawns: structuresData.spawns,
            extensions: structuresData.extensions,
            containers: structuresData.containers,
            towers: structuresData.towers,
            roads: structuresData.roads
          };
        }

        // Extract construction sites
        if (latestStats.constructionSites !== undefined) {
          const sitesData = latestStats.constructionSites as { count?: number; byType?: Record<string, number> };
          snapshot.constructionSites = {
            count: Number(sitesData.count) || 0,
            byType: sitesData.byType
          };
        }

        // Extract spawn data
        if (latestStats.spawns !== undefined) {
          snapshot.spawns = {
            total: Number(latestStats.spawns) || 0,
            active: Number(latestStats.activeSpawns) || 0
          };
        }
      }
    }
  }

  // Phase 2: Collect telemetry from all discovered shards using console API
  // Stats API only returns data from Memory.stats (single shard), but console API can query any shard
  console.log("\nPhase 2: Collecting telemetry from all shards...");
  
  // Aggregate data from all shards
  const aggregatedRooms: Record<string, BotSnapshot["rooms"][string]> = {};
  let totalCreeps = 0;
  const creepsByRole: Record<string, number> = {};
  let latestTick: number | undefined;
  let latestCpu: BotSnapshot["cpu"] | undefined;

  for (const shard of shardDiscovery.shards) {
    console.log(`\nCollecting from shard: ${shard.name}...`);
    
    try {
      // Use console telemetry for per-shard data collection
      // Note: fetchConsoleTelemetry uses SCREEPS_SHARD env var, so we temporarily override it
      const originalShard = process.env.SCREEPS_SHARD;
      process.env.SCREEPS_SHARD = shard.name;
      
      const consoleTelemetry = await fetchConsoleTelemetry();
      
      // Restore original shard
      process.env.SCREEPS_SHARD = originalShard;
      
      console.log(`  ✓ Shard ${shard.name}: ${consoleTelemetry.rooms.length} rooms, ${consoleTelemetry.creeps.total} creeps`);
      
      // Aggregate CPU data (use latest tick's CPU)
      if (!latestTick || consoleTelemetry.tick > latestTick) {
        latestTick = consoleTelemetry.tick;
        latestCpu = {
          used: consoleTelemetry.cpu.used,
          limit: consoleTelemetry.cpu.limit,
          bucket: consoleTelemetry.cpu.bucket
        };
      }
      
      // Aggregate rooms
      for (const room of consoleTelemetry.rooms) {
        aggregatedRooms[room.name] = {
          rcl: room.rcl,
          energy: room.energy,
          energyCapacity: room.energyCapacity,
          controllerProgress: room.controllerProgress,
          controllerProgressTotal: room.controllerProgressTotal,
          ticksToDowngrade: room.ticksToDowngrade,
          shard: shard.name
        };
      }
      
      // Aggregate creeps
      totalCreeps += consoleTelemetry.creeps.total;
      for (const [role, count] of Object.entries(consoleTelemetry.creeps.byRole)) {
        creepsByRole[role] = (creepsByRole[role] || 0) + count;
      }
    } catch (shardError) {
      console.warn(`  ⚠ Failed to collect from shard ${shard.name}:`, shardError);
      // Continue with other shards even if one fails
    }
  }
  
  // Update snapshot with aggregated multi-shard data
  if (latestCpu) {
    snapshot.cpu = latestCpu;
  }
  if (latestTick) {
    snapshot.tick = latestTick;
  }
  if (Object.keys(aggregatedRooms).length > 0) {
    snapshot.rooms = aggregatedRooms;
  }
  snapshot.creeps = {
    total: totalCreeps,
    byRole: Object.keys(creepsByRole).length > 0 ? creepsByRole : undefined
  };
  
  console.log(`\n✓ Multi-shard aggregation complete:`);
  console.log(`  Total rooms: ${Object.keys(aggregatedRooms).length}`);
  console.log(`  Total creeps: ${totalCreeps}`);
  console.log(`  Rooms by shard:`, shardDiscovery.shards.map(s => `${s.name}=${s.rooms.length}`).join(", "));
  
  // If snapshot is still empty after multi-shard collection, try Stats API fallback
  if (!hasSubstantiveData(snapshot)) {
    console.log("\n⚠ Multi-shard collection returned empty data - attempting Stats API fallback...");

    try {
      // Stats API fallback uses the data from Memory.stats (already attempted above)
      // This path should rarely be hit if console telemetry is working
      console.warn("Stats API fallback: No additional data available");
      console.warn("Snapshot will contain only timestamp and shard discovery metadata");
    } catch (fallbackError) {
      console.warn("Stats API fallback failed:", fallbackError);
      console.warn("Snapshot will contain only timestamp");
    }
  }

  // Phase 3: Validate snapshot quality
  console.log("\nPhase 3: Validating snapshot quality...");
  
  // Load previous snapshot for comparison
  let previousSnapshot: BotSnapshot | undefined;
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const prevFilename = `snapshot-${yesterday.toISOString().split("T")[0]}.json`;
    const prevPath = resolve(SNAPSHOTS_DIR, prevFilename);
    const prevContent = readFileSync(prevPath, "utf-8");
    previousSnapshot = JSON.parse(prevContent);
  } catch {
    // Previous snapshot not available (expected for first run)
    console.log("  No previous snapshot available for comparison");
  }
  
  const validationErrors = validateSnapshotQuality(snapshot, previousSnapshot);
  
  if (validationErrors.length > 0) {
    console.error("\n❌ Snapshot validation failed:");
    for (const error of validationErrors) {
      console.error(`  - ${error}`);
    }
    
    // Determine if errors are fatal (should fail workflow)
    const hasFatalError = validationErrors.some(e => e.includes("CRITICAL") || e.includes("no substantive data"));
    
    if (hasFatalError) {
      console.error("\n❌ Fatal validation errors detected - refusing to commit invalid snapshot");
      console.error("This prevents false positive alerts from stale/empty data");
      process.exit(1);
    } else {
      console.warn("\n⚠ Non-fatal validation warnings detected - snapshot will be saved with warnings");
    }
  } else {
    console.log("  ✓ Snapshot validation passed");
  }

  // Write snapshot with date-based filename using snapshot timestamp
  let filenameDate: string;
  try {
    filenameDate = new Date(snapshot.timestamp).toISOString().split("T")[0];
  } catch {
    // Fallback to current date if snapshot timestamp is invalid
    filenameDate = new Date().toISOString().split("T")[0];
  }
  const filename = `snapshot-${filenameDate}.json`;
  const snapshotPath = resolve(SNAPSHOTS_DIR, filename);

  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
  console.log(`\n✓ Snapshot saved: ${snapshotPath}`);
  
  // Log snapshot summary
  console.log("\nSnapshot Summary:");
  console.log(`  Timestamp: ${snapshot.timestamp}`);
  console.log(`  Tick: ${snapshot.tick || "N/A"}`);
  console.log(`  Shards: ${snapshot.shards?.length || 0}`);
  console.log(`  Rooms: ${Object.keys(snapshot.rooms || {}).length}`);
  console.log(`  Creeps: ${snapshot.creeps?.total || 0}`);
  console.log(`  CPU: ${snapshot.cpu ? `${snapshot.cpu.used.toFixed(2)}/${snapshot.cpu.limit} (bucket: ${snapshot.cpu.bucket})` : "N/A"}`);

  // Cleanup old snapshots
  cleanupOldSnapshots();

  console.log(`\n✓ Keeping ${MAX_SNAPSHOTS} most recent snapshots`);
}

collectBotSnapshot().catch(error => {
  console.error("Failed to collect bot snapshot:", error);
  process.exit(1);
});
