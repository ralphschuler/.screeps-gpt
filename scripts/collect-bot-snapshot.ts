import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface BotSnapshot {
  timestamp: string;
  tick?: number;
  cpu?: {
    used: number;
    limit: number;
    bucket: number;
  };
  rooms?: Record<
    string,
    {
      rcl: number;
      energy: number;
      energyCapacity: number;
      controllerProgress?: number;
      controllerProgressTotal?: number;
    }
  >;
  creeps?: {
    total: number;
    byRole?: Record<string, number>;
  };
  spawns?: {
    total: number;
    active: number;
  };
}

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
 * Collect bot state snapshot from Screeps stats
 */
async function collectBotSnapshot(): Promise<void> {
  console.log("Collecting bot state snapshot...\n");

  // Create snapshots directory
  mkdirSync(SNAPSHOTS_DIR, { recursive: true });

  // Try to read the latest stats from screeps-stats
  const statsPath = resolve("reports", "screeps-stats", "latest.json");
  let statsData: { payload?: { stats?: Record<string, unknown> } } | null = null;

  try {
    const statsContent = readFileSync(statsPath, "utf-8");
    statsData = JSON.parse(statsContent);
  } catch {
    console.warn("Failed to read Screeps stats, creating empty snapshot");
  }

  const timestamp = new Date().toISOString();
  const snapshot: BotSnapshot = {
    timestamp
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
          snapshot.tick = Number(latestStats.tick);
        }

        // Extract room data
        if (latestStats.rooms) {
          snapshot.rooms = {};
          for (const [roomName, roomData] of Object.entries(
            latestStats.rooms as Record<string, Record<string, unknown>>
          )) {
            // Prefer more specific field names, fall back to alternatives
            const rcl =
              roomData.rcl !== undefined
                ? Number(roomData.rcl)
                : roomData.controllerLevel !== undefined
                  ? Number(roomData.controllerLevel)
                  : 0;
            const energy =
              roomData.energy !== undefined
                ? Number(roomData.energy)
                : roomData.energyAvailable !== undefined
                  ? Number(roomData.energyAvailable)
                  : 0;
            const energyCapacity =
              roomData.energyCapacity !== undefined
                ? Number(roomData.energyCapacity)
                : roomData.energyCapacityAvailable !== undefined
                  ? Number(roomData.energyCapacityAvailable)
                  : 0;

            snapshot.rooms[roomName] = {
              rcl,
              energy,
              energyCapacity,
              controllerProgress: roomData.controllerProgress ? Number(roomData.controllerProgress) : undefined,
              controllerProgressTotal: roomData.controllerProgressTotal
                ? Number(roomData.controllerProgressTotal)
                : undefined
            };
          }
        }

        // Extract creep data
        if (latestStats.creeps !== undefined) {
          snapshot.creeps = {
            total: Number(latestStats.creeps) || 0,
            byRole: latestStats.creepsByRole as Record<string, number> | undefined
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

  // Write snapshot with date-based filename
  const date = new Date();
  const filename = `snapshot-${date.toISOString().split("T")[0]}.json`;
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
