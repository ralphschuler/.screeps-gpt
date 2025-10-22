import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { sendPushNotification } from "./send-push-notification.js";

interface TickStats {
  cpu?: {
    used?: number;
    limit?: number;
  };
  resources?: {
    energy?: number;
  };
}

interface PTRStatsSnapshot {
  fetchedAt: string;
  endpoint: string;
  payload: {
    stats?: Record<string, TickStats>;
    ok?: number;
  };
}

interface AlertCondition {
  type: string;
  severity: "critical" | "high" | "medium";
  message: string;
}

/**
 * Analyze PTR stats for critical conditions that require push notifications
 * @param snapshot PTR stats snapshot
 * @returns Array of alert conditions
 */
function analyzePTRStats(snapshot: PTRStatsSnapshot): AlertCondition[] {
  const alerts: AlertCondition[] = [];

  if (!snapshot.payload || !snapshot.payload.stats) {
    alerts.push({
      type: "data_unavailable",
      severity: "high",
      message: "PTR stats data unavailable or invalid"
    });
    return alerts;
  }

  const stats = snapshot.payload.stats;

  // Check for recent entries (last 5 ticks)
  const recentTicks: TickStats[] = Object.keys(stats)
    .sort()
    .slice(-5)
    .map(key => stats[key]);

  if (recentTicks.length === 0) {
    alerts.push({
      type: "no_data",
      severity: "medium",
      message: "No recent PTR stats available for analysis"
    });
    return alerts;
  }

  // Check for high CPU usage (>80% sustained)
  const highCPUTicks = recentTicks.filter(tick => {
    const cpuUsed = tick?.cpu?.used || 0;
    const cpuLimit = tick?.cpu?.limit || 100;
    return cpuUsed > 0 && cpuUsed / cpuLimit > 0.8;
  });

  if (highCPUTicks.length >= 3) {
    const avgUsage =
      highCPUTicks.reduce((sum, tick) => {
        return sum + ((tick?.cpu?.used || 0) / (tick?.cpu?.limit || 100)) * 100;
      }, 0) / highCPUTicks.length;

    alerts.push({
      type: "high_cpu",
      severity: avgUsage > 95 ? "critical" : "high",
      message: `High CPU usage detected: ${avgUsage.toFixed(1)}% average over ${highCPUTicks.length} ticks`
    });
  }

  // Check for low energy levels
  const lowEnergyTicks = recentTicks.filter(tick => {
    const energy = tick?.resources?.energy || 0;
    return energy > 0 && energy < 1000;
  });

  if (lowEnergyTicks.length >= 3) {
    alerts.push({
      type: "low_energy",
      severity: "medium",
      message: `Low energy reserves detected in ${lowEnergyTicks.length} recent ticks`
    });
  }

  return alerts;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const snapshotPath = resolve("reports", "screeps-stats", "latest.json");

  // Check if snapshot exists
  if (!existsSync(snapshotPath)) {
    console.log("No PTR stats snapshot found, skipping alert check");
    return;
  }

  // Read and parse snapshot
  let snapshot: PTRStatsSnapshot;
  try {
    const content = readFileSync(snapshotPath, "utf-8");
    snapshot = JSON.parse(content) as PTRStatsSnapshot;
  } catch (error) {
    console.error("Failed to parse PTR stats snapshot:", error);
    return;
  }

  // Analyze for alert conditions
  const alerts = analyzePTRStats(snapshot);

  // Send push notifications for critical and high severity alerts
  for (const alert of alerts) {
    if (alert.severity === "critical" || alert.severity === "high") {
      const priority = alert.severity === "critical" ? 5 : 4;
      const runId = process.env.GITHUB_RUN_ID || "unknown";
      const repo = process.env.GITHUB_REPOSITORY || "ralphschuler/.screeps-gpt";

      await sendPushNotification({
        title: `PTR Alert: ${alert.type}`,
        body: alert.message,
        link: `https://github.com/${repo}/actions/runs/${runId}`,
        priority: priority as 1 | 2 | 3 | 4 | 5
      });

      // Add delay between notifications to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
  }

  console.log(
    `Processed ${alerts.length} alert conditions, sent notifications for ${alerts.filter(a => a.severity === "critical" || a.severity === "high").length} critical/high alerts`
  );
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(1);
  });
}

export { analyzePTRStats };
export type { PTRStatsSnapshot, AlertCondition };
