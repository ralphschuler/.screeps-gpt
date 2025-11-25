import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { BotSnapshot } from "./types/bot-snapshot";

interface AnalyticsDataPoint {
  date: string;
  cpuUsed?: number;
  cpuBucket?: number;
  cpuLimit?: number;
  creepCount?: number;
  roomCount?: number;
  totalEnergy?: number;
  totalEnergyCapacity?: number;
  averageRcl?: number;
  memoryUsed?: number;
  memoryUsedPercent?: number;
  containerCount?: number;
  roadCount?: number;
  towerCount?: number;
  extensionCount?: number;
  spawnCount?: number;
  activeSpawnCount?: number;
  controllerProgress?: number;
  controllerProgressTotal?: number;
}

interface AnalyticsData {
  generated: string;
  period: string;
  dataPoints: AnalyticsDataPoint[];
}

/**
 * Extract date (YYYY-MM-DD) from ISO timestamp
 * @param timestamp - ISO 8601 timestamp string
 * @returns Date string in YYYY-MM-DD format
 */
function extractDate(timestamp: string): string {
  return timestamp.split("T")[0];
}

/**
 * Generate analytics data from bot snapshots for visualization
 */
function generateAnalytics(): void {
  console.log("Generating analytics data from snapshots...\n");

  const snapshotsDir = resolve("reports", "bot-snapshots");
  // Output to Hexo docs source directory
  const outputDir = resolve("packages", "docs", "source", "docs", "analytics");
  const outputPath = resolve(outputDir, "data.json");

  // Read all snapshot files
  let files: string[] = [];
  try {
    files = readdirSync(snapshotsDir)
      .filter(f => f.endsWith(".json"))
      .sort();
  } catch {
    console.warn("No snapshots directory found, creating empty analytics");
    files = [];
  }

  const dataPoints: AnalyticsDataPoint[] = [];
  let failedSnapshots = 0;

  // Process each snapshot
  for (const file of files) {
    try {
      const filePath = resolve(snapshotsDir, file);
      const content = readFileSync(filePath, "utf-8");
      const snapshot: BotSnapshot = JSON.parse(content);

      const dataPoint: AnalyticsDataPoint = {
        date: extractDate(snapshot.timestamp)
      };

      // Extract CPU metrics
      if (snapshot.cpu) {
        dataPoint.cpuUsed = snapshot.cpu.used;
        dataPoint.cpuBucket = snapshot.cpu.bucket;
        dataPoint.cpuLimit = snapshot.cpu.limit;
      }

      // Extract creep count
      if (snapshot.creeps) {
        dataPoint.creepCount = snapshot.creeps.total;
      }

      // Extract room metrics (filter out non-room entries like "count")
      if (snapshot.rooms) {
        const roomEntries = Object.entries(snapshot.rooms).filter(([name]) => /^[EW]\d+[NS]\d+$/.test(name));
        const rooms = roomEntries.map(([, data]) => data);
        dataPoint.roomCount = rooms.length;

        if (rooms.length > 0) {
          dataPoint.totalEnergy = rooms.reduce((sum, room) => sum + (room.energy || 0), 0);
          dataPoint.totalEnergyCapacity = rooms.reduce((sum, room) => sum + (room.energyCapacity || 0), 0);
          dataPoint.averageRcl = rooms.reduce((sum, room) => sum + (room.rcl || 0), 0) / rooms.length;

          // Aggregate controller progress from all rooms
          const roomsWithProgress = rooms.filter(room => room.controllerProgress !== undefined);
          if (roomsWithProgress.length > 0) {
            dataPoint.controllerProgress = roomsWithProgress.reduce(
              (sum, room) => sum + (room.controllerProgress || 0),
              0
            );
            dataPoint.controllerProgressTotal = roomsWithProgress.reduce(
              (sum, room) => sum + (room.controllerProgressTotal || 0),
              0
            );
          }
        }
      }

      // Extract memory metrics
      if (snapshot.memory) {
        dataPoint.memoryUsed = snapshot.memory.used;
        dataPoint.memoryUsedPercent = snapshot.memory.usedPercent;
      }

      // Extract structure metrics
      if (snapshot.structures) {
        dataPoint.containerCount = snapshot.structures.containers;
        dataPoint.roadCount = snapshot.structures.roads;
        dataPoint.towerCount = snapshot.structures.towers;
        dataPoint.extensionCount = snapshot.structures.extensions;
      }

      // Extract spawn metrics
      if (snapshot.spawns) {
        dataPoint.spawnCount = snapshot.spawns.total;
        dataPoint.activeSpawnCount = snapshot.spawns.active;
      }

      dataPoints.push(dataPoint);
    } catch (error) {
      failedSnapshots++;
      console.warn(`Failed to process snapshot ${file}:`, error);
    }
  }

  if (failedSnapshots > 0) {
    console.warn(`⚠ ${failedSnapshots} snapshot(s) failed to process`);
  }

  const analytics: AnalyticsData = {
    generated: new Date().toISOString(),
    period: "30 days",
    dataPoints
  };

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Write analytics data
  writeFileSync(outputPath, JSON.stringify(analytics, null, 2));
  console.log(`✓ Analytics data generated: ${outputPath}`);
  console.log(`✓ Data points: ${dataPoints.length}`);
}

generateAnalytics();
