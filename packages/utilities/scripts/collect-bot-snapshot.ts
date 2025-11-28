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

  // If snapshot is empty (no substantive data), try console API fallback
  if (!hasSubstantiveData(snapshot)) {
    console.log("\n⚠ Stats API returned empty data - attempting console API fallback...");

    try {
      const consoleTelemetry = await fetchConsoleTelemetry();
      console.log("✓ Console telemetry fetch successful");

      // Populate snapshot from console telemetry
      snapshot.cpu = {
        used: consoleTelemetry.cpu.used,
        limit: consoleTelemetry.cpu.limit,
        bucket: consoleTelemetry.cpu.bucket
      };

      // Map rooms from console telemetry
      if (consoleTelemetry.rooms && consoleTelemetry.rooms.length > 0) {
        snapshot.rooms = {};
        for (const room of consoleTelemetry.rooms) {
          snapshot.rooms[room.name] = {
            rcl: room.rcl,
            energy: room.energy,
            energyCapacity: room.energyCapacity,
            controllerProgress: room.controllerProgress,
            controllerProgressTotal: room.controllerProgressTotal,
            ticksToDowngrade: room.ticksToDowngrade
          };
        }
      }

      // Map creeps from console telemetry
      snapshot.creeps = {
        total: consoleTelemetry.creeps.total,
        byRole: consoleTelemetry.creeps.byRole
      };

      // Set tick if available from consoleTelemetry, else leave undefined
      snapshot.tick = typeof consoleTelemetry.tick === "number" ? consoleTelemetry.tick : undefined;
      console.log(
        `✓ Enriched snapshot with console data: ${Object.keys(snapshot.rooms || {}).length} rooms, ${snapshot.creeps.total} creeps`
      );
    } catch (consoleError) {
      console.warn("Console API fallback failed:", consoleError);
      console.warn("Snapshot will contain only timestamp");
    }
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
  console.log(`✓ Snapshot saved: ${snapshotPath}`);

  // Cleanup old snapshots
  cleanupOldSnapshots();

  console.log(`✓ Keeping ${MAX_SNAPSHOTS} most recent snapshots`);
}

collectBotSnapshot().catch(error => {
  console.error("Failed to collect bot snapshot:", error);
  process.exit(1);
});
