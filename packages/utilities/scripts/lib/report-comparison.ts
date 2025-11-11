import type { PTRStatsSnapshot } from "../check-ptr-alerts";

/**
 * Interface for PTR stats comparison result
 */
export interface PTRStatsComparison {
  current: PTRStatsSnapshot;
  previous: PTRStatsSnapshot | null;
  hasHistoricalData: boolean;
  trend: {
    cpuUsageChange?: number; // Percentage change
    energyChange?: number; // Percentage change
    description: string;
  };
  alerts: string[];
}

/**
 * Interface for system evaluation comparison result
 */
export interface EvaluationComparison {
  current: SystemEvaluationReport;
  previous: SystemEvaluationReport | null;
  hasHistoricalData: boolean;
  changes: {
    findingsAdded: number;
    findingsRemoved: number;
    summaryChanged: boolean;
  };
  trend: string;
}

/**
 * Interface for system evaluation report
 */
export interface SystemEvaluationReport {
  tick: number;
  summary: string;
  findings: Array<{
    severity: string;
    title: string;
    recommendation: string;
  }>;
  repository?: {
    lintErrors?: number;
    testFailures?: number;
    timestamp?: string;
  };
}

/**
 * Calculate average CPU usage from PTR stats
 * @param snapshot PTR stats snapshot
 * @param tickCount Number of recent ticks to analyze (default: 5)
 * @returns Average CPU usage percentage or null if no data
 */
function calculateAverageCpuUsage(snapshot: PTRStatsSnapshot, tickCount: number = 5): number | null {
  if (!snapshot.payload || !snapshot.payload.stats) {
    return null;
  }

  const stats = snapshot.payload.stats;
  const recentTicks = Object.keys(stats)
    .sort()
    .slice(-tickCount)
    .map(key => stats[key]);

  if (recentTicks.length === 0) {
    return null;
  }

  const cpuUsages = recentTicks
    .map(tick => {
      const cpuUsed = tick?.cpu?.used || 0;
      const cpuLimit = tick?.cpu?.limit || 100;
      return cpuLimit > 0 ? (cpuUsed / cpuLimit) * 100 : 0;
    })
    .filter(usage => usage > 0);

  if (cpuUsages.length === 0) {
    return null;
  }

  return cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length;
}

/**
 * Calculate average energy from PTR stats
 * @param snapshot PTR stats snapshot
 * @param tickCount Number of recent ticks to analyze (default: 5)
 * @returns Average energy or null if no data
 */
function calculateAverageEnergy(snapshot: PTRStatsSnapshot, tickCount: number = 5): number | null {
  if (!snapshot.payload || !snapshot.payload.stats) {
    return null;
  }

  const stats = snapshot.payload.stats;
  const recentTicks = Object.keys(stats)
    .sort()
    .slice(-tickCount)
    .map(key => stats[key]);

  if (recentTicks.length === 0) {
    return null;
  }

  const energyValues = recentTicks.map(tick => tick?.resources?.energy || 0).filter(energy => energy > 0);

  if (energyValues.length === 0) {
    return null;
  }

  return energyValues.reduce((sum, energy) => sum + energy, 0) / energyValues.length;
}

/**
 * Compare current PTR stats with previous snapshot
 * @param current Current PTR stats snapshot
 * @param previous Previous PTR stats snapshot (can be null)
 * @returns Comparison result with trend analysis
 */
export function comparePTRStats(current: PTRStatsSnapshot, previous: PTRStatsSnapshot | null): PTRStatsComparison {
  const comparison: PTRStatsComparison = {
    current,
    previous,
    hasHistoricalData: previous !== null,
    trend: {
      description: "No historical data available for comparison"
    },
    alerts: []
  };

  if (!previous) {
    return comparison;
  }

  // Calculate CPU usage changes
  const currentCpu = calculateAverageCpuUsage(current);
  const previousCpu = calculateAverageCpuUsage(previous);

  if (currentCpu !== null && previousCpu !== null && previousCpu > 0) {
    const cpuChange = ((currentCpu - previousCpu) / previousCpu) * 100;
    comparison.trend.cpuUsageChange = cpuChange;

    if (Math.abs(cpuChange) > 10) {
      const direction = cpuChange > 0 ? "increased" : "decreased";
      comparison.alerts.push(
        `CPU usage ${direction} by ${Math.abs(cpuChange).toFixed(1)}% (from ${previousCpu.toFixed(1)}% to ${currentCpu.toFixed(1)}%)`
      );
    }
  }

  // Calculate energy changes
  const currentEnergy = calculateAverageEnergy(current);
  const previousEnergy = calculateAverageEnergy(previous);

  if (currentEnergy !== null && previousEnergy !== null && previousEnergy > 0) {
    const energyChange = ((currentEnergy - previousEnergy) / previousEnergy) * 100;
    comparison.trend.energyChange = energyChange;

    if (Math.abs(energyChange) > 20) {
      const direction = energyChange > 0 ? "increased" : "decreased";
      comparison.alerts.push(
        `Energy reserves ${direction} by ${Math.abs(energyChange).toFixed(1)}% (from ${previousEnergy.toFixed(0)} to ${currentEnergy.toFixed(0)})`
      );
    }
  }

  // Generate trend description
  const trendParts: string[] = [];

  if (comparison.trend.cpuUsageChange !== undefined) {
    const cpuDirection = comparison.trend.cpuUsageChange > 0 ? "increased" : "decreased";
    trendParts.push(`CPU ${cpuDirection} ${Math.abs(comparison.trend.cpuUsageChange).toFixed(1)}%`);
  }

  if (comparison.trend.energyChange !== undefined) {
    const energyDirection = comparison.trend.energyChange > 0 ? "increased" : "decreased";
    trendParts.push(`energy ${energyDirection} ${Math.abs(comparison.trend.energyChange).toFixed(1)}%`);
  }

  comparison.trend.description =
    trendParts.length > 0 ? `Compared to previous run: ${trendParts.join(", ")}` : "No significant changes detected";

  return comparison;
}

/**
 * Compare current system evaluation with previous report
 * @param current Current evaluation report
 * @param previous Previous evaluation report (can be null)
 * @returns Comparison result with changes summary
 */
export function compareEvaluations(
  current: SystemEvaluationReport,
  previous: SystemEvaluationReport | null
): EvaluationComparison {
  const comparison: EvaluationComparison = {
    current,
    previous,
    hasHistoricalData: previous !== null,
    changes: {
      findingsAdded: 0,
      findingsRemoved: 0,
      summaryChanged: false
    },
    trend: "No historical data available for comparison"
  };

  if (!previous) {
    return comparison;
  }

  // Compare findings
  const currentFindingsCount = current.findings.length;
  const previousFindingsCount = previous.findings.length;

  comparison.changes.findingsAdded = Math.max(0, currentFindingsCount - previousFindingsCount);
  comparison.changes.findingsRemoved = Math.max(0, previousFindingsCount - currentFindingsCount);
  comparison.changes.summaryChanged = current.summary !== previous.summary;

  // Generate trend description
  const trendParts: string[] = [];

  if (comparison.changes.findingsAdded > 0) {
    trendParts.push(`${comparison.changes.findingsAdded} new finding(s)`);
  }

  if (comparison.changes.findingsRemoved > 0) {
    trendParts.push(`${comparison.changes.findingsRemoved} finding(s) resolved`);
  }

  if (comparison.changes.summaryChanged) {
    trendParts.push("system summary changed");
  }

  comparison.trend =
    trendParts.length > 0
      ? `Compared to previous evaluation: ${trendParts.join(", ")}`
      : "No changes detected since last evaluation";

  return comparison;
}

/**
 * Generate a human-readable trend report from PTR stats comparison
 * @param comparison PTR stats comparison result
 * @returns Formatted trend report string
 */
export function formatPTRTrendReport(comparison: PTRStatsComparison): string {
  const lines: string[] = ["=== PTR Stats Trend Analysis ===", ""];

  if (!comparison.hasHistoricalData) {
    lines.push("No historical data available for comparison.");
    lines.push("This is the first data point or previous reports were not found.");
    return lines.join("\n");
  }

  lines.push(comparison.trend.description);

  if (comparison.alerts.length > 0) {
    lines.push("");
    lines.push("Notable Changes:");
    for (const alert of comparison.alerts) {
      lines.push(`  • ${alert}`);
    }
  }

  return lines.join("\n");
}

/**
 * Generate a human-readable trend report from evaluation comparison
 * @param comparison Evaluation comparison result
 * @returns Formatted trend report string
 */
export function formatEvaluationTrendReport(comparison: EvaluationComparison): string {
  const lines: string[] = ["=== System Evaluation Trend Analysis ===", ""];

  if (!comparison.hasHistoricalData) {
    lines.push("No historical evaluation data available.");
    return lines.join("\n");
  }

  lines.push(comparison.trend);

  if (comparison.changes.findingsAdded > 0 || comparison.changes.findingsRemoved > 0) {
    lines.push("");
    lines.push("Finding Changes:");
    if (comparison.changes.findingsAdded > 0) {
      lines.push(`  + ${comparison.changes.findingsAdded} new finding(s) detected`);
    }
    if (comparison.changes.findingsRemoved > 0) {
      lines.push(`  - ${comparison.changes.findingsRemoved} finding(s) resolved`);
    }
  }

  return lines.join("\n");
}
