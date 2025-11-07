import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
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

interface AnalyticsDataPoint {
  date: string;
  cpuUsed?: number;
  cpuBucket?: number;
  creepCount?: number;
  roomCount?: number;
  totalEnergy?: number;
  averageRcl?: number;
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
  const outputDir = resolve("source", "docs", "analytics");
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
      }

      // Extract creep count
      if (snapshot.creeps) {
        dataPoint.creepCount = snapshot.creeps.total;
      }

      // Extract room metrics
      if (snapshot.rooms) {
        const rooms = Object.values(snapshot.rooms);
        dataPoint.roomCount = rooms.length;

        if (rooms.length > 0) {
          dataPoint.totalEnergy = rooms.reduce((sum, room) => sum + room.energy, 0);
          dataPoint.averageRcl = rooms.reduce((sum, room) => sum + room.rcl, 0) / rooms.length;
        }
      }

      dataPoints.push(dataPoint);
    } catch (error) {
      console.warn(`Failed to process snapshot ${file}:`, error);
    }
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
