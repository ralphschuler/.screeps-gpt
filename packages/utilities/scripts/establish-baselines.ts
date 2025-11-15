import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { BotSnapshot } from "./types/bot-snapshot";

/**
 * Performance baseline metrics structure
 */
interface BaselineMetrics {
  version: string;
  generatedAt: string;
  dataPointCount: number;
  collectionPeriod: {
    startDate: string;
    endDate: string;
    durationHours: number;
  };
  cpu: {
    used: {
      mean: number;
      stdDev: number;
      percentile95: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
    bucket: {
      mean: number;
      stdDev: number;
      trendRate: number; // Positive = growing, negative = decaying
      warningThreshold: number;
      criticalThreshold: number;
    };
  };
  energy: {
    incomePerRoom: {
      mean: number;
      stdDev: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
    storageTotal: {
      mean: number;
      stdDev: number;
      accumulationRate: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
  };
  creeps: {
    total: {
      mean: number;
      stdDev: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
    byRole: Record<
      string,
      {
        mean: number;
        stdDev: number;
        warningThreshold: number;
        criticalThreshold: number;
      }
    >;
  };
  rooms: {
    controlledCount: {
      mean: number;
      stdDev: number;
    };
    rclProgressRate: {
      mean: number;
      stdDev: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
  };
  spawns: {
    uptimePercentage: {
      mean: number;
      stdDev: number;
      warningThreshold: number;
      criticalThreshold: number;
    };
  };
  metadata: {
    methodology: string;
    confidenceLevel: string;
    recalibrationRecommended: string;
  };
}

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation of an array of numbers
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Calculate the 95th percentile of an array of numbers
 */
function calculatePercentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[index];
}

/**
 * Calculate trend rate (simple linear regression slope)
 */
function calculateTrendRate(values: number[]): number {
  if (values.length < 2) return 0;

  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumXX += i * i;
  }

  // Slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX)
  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumXX - sumX * sumX;

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Extract numeric values from snapshots for a specific field
 */
function extractValues(snapshots: BotSnapshot[], extractor: (snapshot: BotSnapshot) => number | undefined): number[] {
  return snapshots.map(extractor).filter((val): val is number => val !== undefined && Number.isFinite(val));
}

/**
 * Establish performance baselines from bot snapshot history
 */
async function establishBaselines(): Promise<void> {
  console.log("Establishing performance baselines from bot snapshots...\n");

  const snapshotsDir = resolve("reports", "bot-snapshots");
  const outputDir = resolve("reports", "monitoring");
  const outputPath = resolve(outputDir, "baselines.json");

  // Read all snapshot files
  let files: string[] = [];
  try {
    files = readdirSync(snapshotsDir)
      .filter(f => f.endsWith(".json") && !f.endsWith(".gitkeep"))
      .sort();
  } catch (error) {
    console.error("Failed to read snapshots directory:", error);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("No snapshots found. Cannot establish baselines.");
    console.error("Ensure bot snapshots have been collected for at least 24 hours.");
    process.exit(1);
  }

  console.log(`Found ${files.length} snapshot(s)`);

  // Load all snapshots
  const snapshots: BotSnapshot[] = [];
  for (const file of files) {
    try {
      const filePath = resolve(snapshotsDir, file);
      const content = readFileSync(filePath, "utf-8");
      const snapshot: BotSnapshot = JSON.parse(content);
      snapshots.push(snapshot);
    } catch (error) {
      console.warn(`Failed to parse snapshot ${file}:`, error);
    }
  }

  if (snapshots.length === 0) {
    console.error("No valid snapshots could be loaded.");
    process.exit(1);
  }

  // Warn if insufficient data
  if (snapshots.length < 48) {
    console.warn(`⚠ Warning: Only ${snapshots.length} snapshots available.`);
    console.warn("  Recommended: 48+ snapshots (24-48 hours at 30min intervals)");
    console.warn("  Statistical confidence may be low.\n");
  }

  // Calculate collection period
  const timestamps = snapshots.map(s => new Date(s.timestamp).getTime());
  const startDate = new Date(Math.min(...timestamps)).toISOString();
  const endDate = new Date(Math.max(...timestamps)).toISOString();
  const durationHours = (Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60);

  console.log(`Collection period: ${startDate} to ${endDate}`);
  console.log(`Duration: ${durationHours.toFixed(1)} hours\n`);

  // Extract CPU metrics
  const cpuUsedValues = extractValues(snapshots, s => s.cpu?.used);
  const cpuBucketValues = extractValues(snapshots, s => s.cpu?.bucket);

  const cpuUsedMean = calculateMean(cpuUsedValues);
  const cpuUsedStdDev = calculateStdDev(cpuUsedValues, cpuUsedMean);
  const cpuUsedP95 = calculatePercentile95(cpuUsedValues);

  const cpuBucketMean = calculateMean(cpuBucketValues);
  const cpuBucketStdDev = calculateStdDev(cpuBucketValues, cpuBucketMean);
  const cpuBucketTrend = calculateTrendRate(cpuBucketValues);

  console.log("CPU Metrics:");
  console.log(`  Used: μ=${cpuUsedMean.toFixed(2)}, σ=${cpuUsedStdDev.toFixed(2)}, P95=${cpuUsedP95.toFixed(2)}`);
  console.log(`  Bucket: μ=${cpuBucketMean.toFixed(2)}, σ=${cpuBucketStdDev.toFixed(2)}, trend=${cpuBucketTrend.toFixed(2)}`);

  // Extract energy metrics
  const energyTotalValues = extractValues(snapshots, s => {
    if (!s.rooms) return undefined;
    return Object.values(s.rooms).reduce((sum, room) => sum + room.energy, 0);
  });

  const roomCountValues = extractValues(snapshots, s => (s.rooms ? Object.keys(s.rooms).length : undefined));

  const energyIncomePerRoomValues =
    roomCountValues.length > 0
      ? energyTotalValues.map((total, i) => (roomCountValues[i] > 0 ? total / roomCountValues[i] : 0))
      : [];

  const energyTotalMean = calculateMean(energyTotalValues);
  const energyTotalStdDev = calculateStdDev(energyTotalValues, energyTotalMean);
  const energyTotalTrend = calculateTrendRate(energyTotalValues);

  const energyIncomePerRoomMean = calculateMean(energyIncomePerRoomValues);
  const energyIncomePerRoomStdDev = calculateStdDev(energyIncomePerRoomValues, energyIncomePerRoomMean);

  console.log("Energy Metrics:");
  console.log(`  Total: μ=${energyTotalMean.toFixed(2)}, σ=${energyTotalStdDev.toFixed(2)}, trend=${energyTotalTrend.toFixed(2)}`);
  console.log(`  Per Room: μ=${energyIncomePerRoomMean.toFixed(2)}, σ=${energyIncomePerRoomStdDev.toFixed(2)}`);

  // Extract creep metrics
  const creepTotalValues = extractValues(snapshots, s => s.creeps?.total);
  const creepTotalMean = calculateMean(creepTotalValues);
  const creepTotalStdDev = calculateStdDev(creepTotalValues, creepTotalMean);

  console.log("Creep Metrics:");
  console.log(`  Total: μ=${creepTotalMean.toFixed(2)}, σ=${creepTotalStdDev.toFixed(2)}`);

  // Extract creep by role metrics
  const creepsByRole: Record<string, number[]> = {};
  for (const snapshot of snapshots) {
    if (snapshot.creeps?.byRole) {
      for (const [role, count] of Object.entries(snapshot.creeps.byRole)) {
        if (!creepsByRole[role]) {
          creepsByRole[role] = [];
        }
        creepsByRole[role].push(count);
      }
    }
  }

  const creepsByRoleBaselines: Record<
    string,
    { mean: number; stdDev: number; warningThreshold: number; criticalThreshold: number }
  > = {};

  for (const [role, values] of Object.entries(creepsByRole)) {
    const mean = calculateMean(values);
    const stdDev = calculateStdDev(values, mean);
    creepsByRoleBaselines[role] = {
      mean,
      stdDev,
      warningThreshold: mean - 2 * stdDev, // 30% deviation per spec translates to threshold
      criticalThreshold: mean - 3 * stdDev
    };
    console.log(`  ${role}: μ=${mean.toFixed(2)}, σ=${stdDev.toFixed(2)}`);
  }

  // Extract room metrics
  const roomCountMean = calculateMean(roomCountValues);
  const roomCountStdDev = calculateStdDev(roomCountValues, roomCountMean);

  const rclProgressValues = extractValues(snapshots, s => {
    if (!s.rooms) return undefined;
    const progresses = Object.values(s.rooms)
      .filter(room => room.controllerProgress !== undefined && room.controllerProgressTotal !== undefined)
      .map(room => (room.controllerProgress! / room.controllerProgressTotal!) * 100);
    return progresses.length > 0 ? calculateMean(progresses) : undefined;
  });

  const rclProgressMean = calculateMean(rclProgressValues);
  const rclProgressStdDev = calculateStdDev(rclProgressValues, rclProgressMean);
  const rclProgressTrend = calculateTrendRate(rclProgressValues);

  console.log("Room Metrics:");
  console.log(`  Controlled: μ=${roomCountMean.toFixed(2)}, σ=${roomCountStdDev.toFixed(2)}`);
  console.log(`  RCL Progress: μ=${rclProgressMean.toFixed(2)}%, σ=${rclProgressStdDev.toFixed(2)}%, trend=${rclProgressTrend.toFixed(4)}`);

  // Extract spawn metrics
  const spawnUptimeValues = extractValues(snapshots, s => {
    if (!s.spawns || s.spawns.total === 0) return undefined;
    return (s.spawns.active / s.spawns.total) * 100;
  });

  const spawnUptimeMean = calculateMean(spawnUptimeValues);
  const spawnUptimeStdDev = calculateStdDev(spawnUptimeValues, spawnUptimeMean);

  console.log("Spawn Metrics:");
  console.log(`  Uptime: μ=${spawnUptimeMean.toFixed(2)}%, σ=${spawnUptimeStdDev.toFixed(2)}%\n`);

  // Build baseline metrics structure
  const baselines: BaselineMetrics = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    dataPointCount: snapshots.length,
    collectionPeriod: {
      startDate,
      endDate,
      durationHours: Math.round(durationHours * 10) / 10
    },
    cpu: {
      used: {
        mean: cpuUsedMean,
        stdDev: cpuUsedStdDev,
        percentile95: cpuUsedP95,
        warningThreshold: cpuUsedMean + 2 * cpuUsedStdDev,
        criticalThreshold: cpuUsedMean + 3 * cpuUsedStdDev
      },
      bucket: {
        mean: cpuBucketMean,
        stdDev: cpuBucketStdDev,
        trendRate: cpuBucketTrend,
        warningThreshold: cpuBucketMean - 2 * cpuBucketStdDev,
        criticalThreshold: cpuBucketMean - 3 * cpuBucketStdDev
      }
    },
    energy: {
      incomePerRoom: {
        mean: energyIncomePerRoomMean,
        stdDev: energyIncomePerRoomStdDev,
        warningThreshold: energyIncomePerRoomMean - 2 * energyIncomePerRoomStdDev,
        criticalThreshold: energyIncomePerRoomMean - 3 * energyIncomePerRoomStdDev
      },
      storageTotal: {
        mean: energyTotalMean,
        stdDev: energyTotalStdDev,
        accumulationRate: energyTotalTrend,
        warningThreshold: energyTotalMean - 2 * energyTotalStdDev,
        criticalThreshold: energyTotalMean - 3 * energyTotalStdDev
      }
    },
    creeps: {
      total: {
        mean: creepTotalMean,
        stdDev: creepTotalStdDev,
        warningThreshold: creepTotalMean - 2 * creepTotalStdDev,
        criticalThreshold: creepTotalMean - 3 * creepTotalStdDev
      },
      byRole: creepsByRoleBaselines
    },
    rooms: {
      controlledCount: {
        mean: roomCountMean,
        stdDev: roomCountStdDev
      },
      rclProgressRate: {
        mean: rclProgressMean,
        stdDev: rclProgressStdDev,
        warningThreshold: rclProgressMean - 2 * rclProgressStdDev,
        criticalThreshold: rclProgressMean - 3 * rclProgressStdDev
      }
    },
    spawns: {
      uptimePercentage: {
        mean: spawnUptimeMean,
        stdDev: spawnUptimeStdDev,
        warningThreshold: spawnUptimeMean - 2 * spawnUptimeStdDev,
        criticalThreshold: spawnUptimeMean - 3 * spawnUptimeStdDev
      }
    },
    metadata: {
      methodology: "Mean and standard deviation calculated from historical snapshots. Warning threshold: μ ± 2σ (95% CI). Critical threshold: μ ± 3σ (99.7% CI).",
      confidenceLevel: snapshots.length >= 48 ? "high" : "low",
      recalibrationRecommended: "Weekly or after significant code changes"
    }
  };

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  // Write baselines
  writeFileSync(outputPath, JSON.stringify(baselines, null, 2));
  console.log(`✓ Baselines saved: ${outputPath}`);
  console.log(`✓ Confidence level: ${baselines.metadata.confidenceLevel}`);
  console.log(`✓ Data points: ${baselines.dataPointCount}`);
}

establishBaselines().catch(error => {
  console.error("Failed to establish baselines:", error);
  process.exit(1);
});
