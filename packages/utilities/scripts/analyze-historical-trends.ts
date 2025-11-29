import { mkdirSync, writeFileSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import type { BotSnapshot } from "./types/bot-snapshot";

/**
 * Trend period configuration
 */
interface TrendPeriod {
  name: string;
  days: number;
  minDataPoints: number;
}

/**
 * Statistical summary for a metric
 */
interface MetricTrend {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: "increasing" | "decreasing" | "stable";
  isRegression: boolean;
}

/**
 * Period trend analysis result
 */
interface PeriodTrend {
  period: string;
  days: number;
  dataPointCount: number;
  dateRange: {
    start: string;
    end: string;
  };
  cpu: {
    used: MetricTrend | null;
    bucket: MetricTrend | null;
    bucketHealth: "healthy" | "warning" | "critical";
  };
  creeps: {
    total: MetricTrend | null;
  };
  rooms: {
    count: MetricTrend | null;
    averageRcl: MetricTrend | null;
    totalProgress: MetricTrend | null;
  };
  energy: {
    total: MetricTrend | null;
    perRoom: MetricTrend | null;
  };
  memory: {
    used: MetricTrend | null;
    usedPercent: MetricTrend | null;
  };
  spawns: {
    utilization: MetricTrend | null;
  };
  regressions: string[];
  improvements: string[];
}

/**
 * Historical trend analysis report
 */
interface HistoricalTrendReport {
  generatedAt: string;
  snapshotsAnalyzed: number;
  periods: {
    sevenDay: PeriodTrend;
    thirtyDay: PeriodTrend;
  };
  overallHealth: "healthy" | "warning" | "critical";
  recommendations: string[];
  alerts: {
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    message: string;
    metric: string;
  }[];
}

/**
 * Thresholds for regression detection
 */
const REGRESSION_THRESHOLDS = {
  cpu: {
    usedIncrease: 10, // >10% CPU increase is a regression
    bucketDecrease: 5, // >5% bucket decrease is a warning
    bucketCritical: 1000 // Bucket below 1000 is critical
  },
  creeps: {
    decrease: 20 // >20% creep decrease may indicate issues
  },
  energy: {
    decrease: 30 // >30% energy decrease is concerning
  },
  memory: {
    increase: 20 // >20% memory increase may indicate leaks
  }
};

/**
 * Load all bot snapshots from the directory
 */
function loadSnapshots(): BotSnapshot[] {
  const snapshotsDir = resolve("reports", "bot-snapshots");

  if (!existsSync(snapshotsDir)) {
    console.warn("Snapshots directory not found");
    return [];
  }

  const files = readdirSync(snapshotsDir)
    .filter(f => f.endsWith(".json") && f.startsWith("snapshot-"))
    .sort();

  const snapshots: BotSnapshot[] = [];

  for (const file of files) {
    try {
      const filePath = resolve(snapshotsDir, file);
      const content = readFileSync(filePath, "utf-8");
      const snapshot = JSON.parse(content) as BotSnapshot;
      snapshots.push(snapshot);
    } catch (error) {
      console.warn(`Failed to load snapshot ${file}:`, error);
    }
  }

  return snapshots;
}

/**
 * Filter snapshots by date range
 */
function filterSnapshotsByDays(snapshots: BotSnapshot[], days: number): BotSnapshot[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  return snapshots.filter(s => new Date(s.timestamp) >= cutoffDate);
}

/**
 * Calculate mean of an array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Extract numeric values from snapshots for a specific metric
 */
function extractValues(snapshots: BotSnapshot[], extractor: (s: BotSnapshot) => number | undefined): number[] {
  return snapshots.map(extractor).filter((val): val is number => val !== undefined && Number.isFinite(val));
}

/**
 * Create a metric trend analysis
 */
function createMetricTrend(
  currentPeriodValues: number[],
  previousPeriodValues: number[],
  higherIsBetter: boolean = true,
  regressionThreshold: number = 10
): MetricTrend | null {
  if (currentPeriodValues.length === 0) return null;

  const current = calculateMean(currentPeriodValues);

  // If no previous period data, use current as baseline to avoid false regression alerts.
  // This results in change=0, changePercent=0, trend="stable", isRegression=false
  // which is the correct behavior for the first data point.
  const previous = previousPeriodValues.length > 0 ? calculateMean(previousPeriodValues) : current;

  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  let trend: "increasing" | "decreasing" | "stable";
  if (Math.abs(changePercent) < 2) {
    trend = "stable";
  } else if (changePercent > 0) {
    trend = "increasing";
  } else {
    trend = "decreasing";
  }

  // Determine if this is a regression
  let isRegression = false;
  if (higherIsBetter) {
    // For metrics where higher is better (e.g., bucket, creeps), decrease is regression
    isRegression = changePercent < -regressionThreshold;
  } else {
    // For metrics where lower is better (e.g., CPU used), increase is regression
    isRegression = changePercent > regressionThreshold;
  }

  return {
    current,
    previous,
    change,
    changePercent,
    trend,
    isRegression
  };
}

/**
 * Analyze trends for a specific period
 */
function analyzePeriod(snapshots: BotSnapshot[], period: TrendPeriod): PeriodTrend {
  const periodSnapshots = filterSnapshotsByDays(snapshots, period.days);

  // Split into current and previous halves for comparison
  const midpoint = Math.floor(periodSnapshots.length / 2);
  const currentHalf = periodSnapshots.slice(midpoint);
  const previousHalf = periodSnapshots.slice(0, midpoint);

  const regressions: string[] = [];
  const improvements: string[] = [];

  // CPU analysis
  const cpuUsedCurrent = extractValues(currentHalf, s => s.cpu?.used);
  const cpuUsedPrevious = extractValues(previousHalf, s => s.cpu?.used);
  const cpuUsedTrend = createMetricTrend(
    cpuUsedCurrent,
    cpuUsedPrevious,
    false,
    REGRESSION_THRESHOLDS.cpu.usedIncrease
  );

  const cpuBucketCurrent = extractValues(currentHalf, s => s.cpu?.bucket);
  const cpuBucketPrevious = extractValues(previousHalf, s => s.cpu?.bucket);
  const cpuBucketTrend = createMetricTrend(
    cpuBucketCurrent,
    cpuBucketPrevious,
    true,
    REGRESSION_THRESHOLDS.cpu.bucketDecrease
  );

  // Determine bucket health
  let bucketHealth: "healthy" | "warning" | "critical" = "healthy";
  if (cpuBucketTrend) {
    if (cpuBucketTrend.current < REGRESSION_THRESHOLDS.cpu.bucketCritical) {
      bucketHealth = "critical";
    } else if (cpuBucketTrend.current < 5000 || cpuBucketTrend.isRegression) {
      bucketHealth = "warning";
    }
  }

  if (cpuUsedTrend?.isRegression) {
    regressions.push(`CPU usage increased by ${cpuUsedTrend.changePercent.toFixed(1)}%`);
  }
  if (cpuBucketTrend?.isRegression) {
    regressions.push(`CPU bucket decreased by ${Math.abs(cpuBucketTrend.changePercent).toFixed(1)}%`);
  }

  // Creep analysis
  const creepsCurrent = extractValues(currentHalf, s => s.creeps?.total);
  const creepsPrevious = extractValues(previousHalf, s => s.creeps?.total);
  const creepsTrend = createMetricTrend(creepsCurrent, creepsPrevious, true, REGRESSION_THRESHOLDS.creeps.decrease);

  if (creepsTrend?.isRegression) {
    regressions.push(`Creep population decreased by ${Math.abs(creepsTrend.changePercent).toFixed(1)}%`);
  }
  if (creepsTrend && creepsTrend.changePercent > 20) {
    improvements.push(`Creep population grew by ${creepsTrend.changePercent.toFixed(1)}%`);
  }

  // Room analysis
  const roomCountExtractor = (s: BotSnapshot) => {
    if (!s.rooms) return undefined;
    const roomNames = Object.keys(s.rooms).filter(name => /^[EW]\d+[NS]\d+$/.test(name));
    return roomNames.length;
  };
  const roomCountCurrent = extractValues(currentHalf, roomCountExtractor);
  const roomCountPrevious = extractValues(previousHalf, roomCountExtractor);
  const roomCountTrend = createMetricTrend(roomCountCurrent, roomCountPrevious, true, 0);

  const rclExtractor = (s: BotSnapshot) => {
    if (!s.rooms) return undefined;
    const rooms = Object.entries(s.rooms).filter(([name]) => /^[EW]\d+[NS]\d+$/.test(name));
    if (rooms.length === 0) return undefined;
    return rooms.reduce((sum, [, room]) => sum + room.rcl, 0) / rooms.length;
  };
  const rclCurrent = extractValues(currentHalf, rclExtractor);
  const rclPrevious = extractValues(previousHalf, rclExtractor);
  const rclTrend = createMetricTrend(rclCurrent, rclPrevious, true, 0);

  const progressExtractor = (s: BotSnapshot) => {
    if (!s.rooms) return undefined;
    const rooms = Object.entries(s.rooms).filter(([name]) => /^[EW]\d+[NS]\d+$/.test(name));
    return rooms.reduce((sum, [, room]) => sum + (room.controllerProgress || 0), 0);
  };
  const progressCurrent = extractValues(currentHalf, progressExtractor);
  const progressPrevious = extractValues(previousHalf, progressExtractor);
  const progressTrend = createMetricTrend(progressCurrent, progressPrevious, true, 0);

  if (progressTrend && progressTrend.change > 0) {
    improvements.push(`Controller progress increased by ${progressTrend.change.toFixed(0)} points`);
  }

  // Energy analysis
  const energyExtractor = (s: BotSnapshot) => {
    if (!s.rooms) return undefined;
    const rooms = Object.entries(s.rooms).filter(([name]) => /^[EW]\d+[NS]\d+$/.test(name));
    return rooms.reduce((sum, [, room]) => sum + room.energy, 0);
  };
  const energyCurrent = extractValues(currentHalf, energyExtractor);
  const energyPrevious = extractValues(previousHalf, energyExtractor);
  const energyTrend = createMetricTrend(energyCurrent, energyPrevious, true, REGRESSION_THRESHOLDS.energy.decrease);

  const energyPerRoomExtractor = (s: BotSnapshot) => {
    if (!s.rooms) return undefined;
    const rooms = Object.entries(s.rooms).filter(([name]) => /^[EW]\d+[NS]\d+$/.test(name));
    if (rooms.length === 0) return undefined;
    const totalEnergy = rooms.reduce((sum, [, room]) => sum + room.energy, 0);
    return totalEnergy / rooms.length;
  };
  const energyPerRoomCurrent = extractValues(currentHalf, energyPerRoomExtractor);
  const energyPerRoomPrevious = extractValues(previousHalf, energyPerRoomExtractor);
  const energyPerRoomTrend = createMetricTrend(
    energyPerRoomCurrent,
    energyPerRoomPrevious,
    true,
    REGRESSION_THRESHOLDS.energy.decrease
  );

  if (energyTrend?.isRegression) {
    regressions.push(`Energy reserves decreased by ${Math.abs(energyTrend.changePercent).toFixed(1)}%`);
  }

  // Memory analysis
  const memoryUsedCurrent = extractValues(currentHalf, s => s.memory?.used);
  const memoryUsedPrevious = extractValues(previousHalf, s => s.memory?.used);
  const memoryUsedTrend = createMetricTrend(
    memoryUsedCurrent,
    memoryUsedPrevious,
    false,
    REGRESSION_THRESHOLDS.memory.increase
  );

  const memoryPercentCurrent = extractValues(currentHalf, s => s.memory?.usedPercent);
  const memoryPercentPrevious = extractValues(previousHalf, s => s.memory?.usedPercent);
  const memoryPercentTrend = createMetricTrend(
    memoryPercentCurrent,
    memoryPercentPrevious,
    false,
    REGRESSION_THRESHOLDS.memory.increase
  );

  if (memoryUsedTrend?.isRegression) {
    regressions.push(`Memory usage increased by ${memoryUsedTrend.changePercent.toFixed(1)}%`);
  }

  // Spawn utilization
  const spawnUtilExtractor = (s: BotSnapshot) => {
    if (!s.spawns || s.spawns.total === 0) return undefined;
    return (s.spawns.active / s.spawns.total) * 100;
  };
  const spawnUtilCurrent = extractValues(currentHalf, spawnUtilExtractor);
  const spawnUtilPrevious = extractValues(previousHalf, spawnUtilExtractor);
  const spawnUtilTrend = createMetricTrend(spawnUtilCurrent, spawnUtilPrevious, true, 0);

  // Determine date range
  const timestamps = periodSnapshots.map(s => new Date(s.timestamp).getTime());
  const startDate = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString();
  const endDate = timestamps.length > 0 ? new Date(Math.max(...timestamps)).toISOString() : new Date().toISOString();

  return {
    period: period.name,
    days: period.days,
    dataPointCount: periodSnapshots.length,
    dateRange: {
      start: startDate,
      end: endDate
    },
    cpu: {
      used: cpuUsedTrend,
      bucket: cpuBucketTrend,
      bucketHealth
    },
    creeps: {
      total: creepsTrend
    },
    rooms: {
      count: roomCountTrend,
      averageRcl: rclTrend,
      totalProgress: progressTrend
    },
    energy: {
      total: energyTrend,
      perRoom: energyPerRoomTrend
    },
    memory: {
      used: memoryUsedTrend,
      usedPercent: memoryPercentTrend
    },
    spawns: {
      utilization: spawnUtilTrend
    },
    regressions,
    improvements
  };
}

/**
 * Generate alerts from period analysis
 */
function generateAlerts(
  period: PeriodTrend
): Array<{ type: string; severity: "critical" | "high" | "medium" | "low"; message: string; metric: string }> {
  const alerts: Array<{
    type: string;
    severity: "critical" | "high" | "medium" | "low";
    message: string;
    metric: string;
  }> = [];

  // CPU bucket critical
  if (period.cpu.bucketHealth === "critical") {
    alerts.push({
      type: "cpu_bucket_critical",
      severity: "critical",
      message: `CPU bucket at ${period.cpu.bucket?.current?.toFixed(0) || "N/A"} - critical level`,
      metric: "cpu.bucket"
    });
  }

  // CPU bucket warning
  if (period.cpu.bucketHealth === "warning") {
    alerts.push({
      type: "cpu_bucket_warning",
      severity: "high",
      message: `CPU bucket at ${period.cpu.bucket?.current?.toFixed(0) || "N/A"} - below healthy threshold`,
      metric: "cpu.bucket"
    });
  }

  // CPU usage regression
  if (period.cpu.used?.isRegression) {
    alerts.push({
      type: "cpu_regression",
      severity: "high",
      message: `CPU usage increased by ${period.cpu.used.changePercent.toFixed(1)}% over ${period.period}`,
      metric: "cpu.used"
    });
  }

  // Creep population drop
  if (period.creeps.total?.isRegression) {
    alerts.push({
      type: "creep_population_drop",
      severity: "medium",
      message: `Creep population dropped by ${Math.abs(period.creeps.total.changePercent).toFixed(1)}%`,
      metric: "creeps.total"
    });
  }

  // Energy regression
  if (period.energy.total?.isRegression) {
    alerts.push({
      type: "energy_regression",
      severity: "medium",
      message: `Energy reserves decreased by ${Math.abs(period.energy.total.changePercent).toFixed(1)}%`,
      metric: "energy.total"
    });
  }

  // Memory growth
  if (period.memory.used?.isRegression) {
    alerts.push({
      type: "memory_growth",
      severity: "medium",
      message: `Memory usage increased by ${period.memory.used.changePercent.toFixed(1)}% - potential leak`,
      metric: "memory.used"
    });
  }

  return alerts;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(sevenDay: PeriodTrend, thirtyDay: PeriodTrend): string[] {
  const recommendations: string[] = [];

  // CPU recommendations
  if (sevenDay.cpu.bucketHealth !== "healthy" || thirtyDay.cpu.bucketHealth !== "healthy") {
    recommendations.push("Review CPU-intensive operations and consider optimization");
    recommendations.push("Check profiler data for hotspots using reports/profiler/latest.json");
  }

  if (sevenDay.cpu.used?.isRegression && thirtyDay.cpu.used?.isRegression) {
    recommendations.push("Sustained CPU regression detected - investigate recent code changes");
  }

  // Creep recommendations
  if (sevenDay.creeps.total?.isRegression) {
    recommendations.push("Creep population declining - verify spawn logic and energy income");
  }

  // Energy recommendations
  if (sevenDay.energy.total?.isRegression && thirtyDay.energy.total?.isRegression) {
    recommendations.push("Energy reserves declining - consider increasing harvester count or optimizing logistics");
  }

  // Memory recommendations
  if (sevenDay.memory.used?.isRegression) {
    recommendations.push("Memory usage growing - check for memory leaks in custom data structures");
  }

  // Data sufficiency
  if (sevenDay.dataPointCount < 7) {
    recommendations.push("Insufficient 7-day data - allow more time for meaningful trend analysis");
  }

  if (thirtyDay.dataPointCount < 14) {
    recommendations.push("Insufficient 30-day data - baselines will be more accurate with more history");
  }

  // Positive recommendations
  if (sevenDay.improvements.length > 0) {
    recommendations.push(`Positive trends: ${sevenDay.improvements.join(", ")}`);
  }

  return recommendations;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("=== Historical Trend Analysis ===\n");

  // Load all snapshots
  const snapshots = loadSnapshots();

  if (snapshots.length === 0) {
    console.error("No snapshots found. Cannot analyze trends.");
    console.error("Ensure bot snapshots have been collected.");
    process.exit(1);
  }

  console.log(`Loaded ${snapshots.length} snapshot(s)\n`);

  // Define analysis periods
  const periods: TrendPeriod[] = [
    { name: "7-day", days: 7, minDataPoints: 7 },
    { name: "30-day", days: 30, minDataPoints: 14 }
  ];

  // Analyze each period
  const sevenDay = analyzePeriod(snapshots, periods[0]);
  const thirtyDay = analyzePeriod(snapshots, periods[1]);

  // Generate alerts from both periods
  const sevenDayAlerts = generateAlerts(sevenDay);
  const thirtyDayAlerts = generateAlerts(thirtyDay);
  const allAlerts = [...sevenDayAlerts, ...thirtyDayAlerts];

  // Determine overall health
  let overallHealth: "healthy" | "warning" | "critical" = "healthy";
  if (allAlerts.some(a => a.severity === "critical")) {
    overallHealth = "critical";
  } else if (allAlerts.some(a => a.severity === "high" || a.severity === "medium")) {
    overallHealth = "warning";
  }

  // Generate recommendations
  const recommendations = generateRecommendations(sevenDay, thirtyDay);

  // Build report
  const report: HistoricalTrendReport = {
    generatedAt: new Date().toISOString(),
    snapshotsAnalyzed: snapshots.length,
    periods: {
      sevenDay,
      thirtyDay
    },
    overallHealth,
    recommendations,
    alerts: allAlerts
  };

  // Save report
  const outputDir = resolve("reports", "monitoring");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "historical-trends.json");
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`✓ Historical trend analysis saved to: ${outputPath}`);
  console.log(`\n=== Summary ===`);
  console.log(`Overall Health: ${overallHealth.toUpperCase()}`);
  console.log(`\n7-Day Analysis:`);
  console.log(`  Data points: ${sevenDay.dataPointCount}`);
  console.log(`  Regressions: ${sevenDay.regressions.length}`);
  console.log(`  Improvements: ${sevenDay.improvements.length}`);

  console.log(`\n30-Day Analysis:`);
  console.log(`  Data points: ${thirtyDay.dataPointCount}`);
  console.log(`  Regressions: ${thirtyDay.regressions.length}`);
  console.log(`  Improvements: ${thirtyDay.improvements.length}`);

  if (allAlerts.length > 0) {
    console.log(`\nAlerts (${allAlerts.length}):`);
    for (const alert of allAlerts) {
      console.log(`  [${alert.severity.toUpperCase()}] ${alert.message}`);
    }
  }

  if (recommendations.length > 0) {
    console.log(`\nRecommendations:`);
    for (const rec of recommendations) {
      console.log(`  • ${rec}`);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export {
  loadSnapshots,
  filterSnapshotsByDays,
  analyzePeriod,
  generateAlerts,
  generateRecommendations,
  REGRESSION_THRESHOLDS
};
export type { HistoricalTrendReport, PeriodTrend, MetricTrend, TrendPeriod };
