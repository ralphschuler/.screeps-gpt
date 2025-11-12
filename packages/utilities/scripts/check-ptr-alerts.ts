import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { sendPushNotification } from "./send-push-notification.js";
import { sendEmailNotification } from "./send-email-notification.js";
import { saveReport, loadLatestReport, applyRetentionPolicy } from "./lib/report-storage.js";
import { comparePTRStats, formatPTRTrendReport } from "./lib/report-comparison.js";

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
  fetchedAt?: string;
  endpoint?: string;
  source?: string;
  payload?: {
    stats?: Record<string, TickStats>;
    ok?: number;
  };
  // Resilience metadata
  fallback_activated?: boolean;
  primary_source_failed?: boolean;
  // Failure snapshot fields
  status?: string;
  failureType?: string;
  timestamp?: string;
  error?: string;
  attempted_endpoint?: string;
  attempted_sources?: string[];
  httpStatus?: number | null;
  httpStatusText?: string | null;
  resilience_status?: string;
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

  // Check for complete infrastructure failure (all sources unavailable)
  if (snapshot.status === "all_sources_unavailable") {
    alerts.push({
      type: "infrastructure_failure",
      severity: "critical",
      message: `Critical: All telemetry sources failed (Stats API + Console). ${snapshot.error || "Complete monitoring blackout"}`
    });
    return alerts;
  }

  // Check for fallback activation (resilience feature working)
  if (snapshot.fallback_activated && snapshot.primary_source_failed) {
    // This is informational - the system is working as designed
    // But we want to track that the primary source is having issues
    alerts.push({
      type: "fallback_activated",
      severity: "medium",
      message: `Telemetry fallback activated: Primary Stats API failed, using Console telemetry. Source: ${snapshot.source || "console"}`
    });
  }

  // Check for API unavailability (network failure or infrastructure issue)
  if (snapshot.status === "api_unavailable") {
    const failureType = snapshot.failureType || "unknown";

    // Network errors represent complete infrastructure failure
    if (failureType === "network_error") {
      alerts.push({
        type: "api_endpoint_unreachable",
        severity: "critical",
        message: `Critical infrastructure failure - API endpoint completely unreachable. Error: ${snapshot.error || "Unknown error"}`
      });
    } else if (failureType.startsWith("http_error_")) {
      const statusCode = snapshot.httpStatus || 0;

      // Determine severity based on HTTP status
      if (statusCode >= 500) {
        alerts.push({
          type: "api_server_error",
          severity: "critical",
          message: `Screeps API server error (${statusCode}): ${snapshot.error || "Server-side failure"}`
        });
      } else if (statusCode === 401 || statusCode === 403) {
        alerts.push({
          type: "api_authentication_failed",
          severity: "high",
          message: `API authentication failure (${statusCode}): Token may be expired or invalid`
        });
      } else {
        alerts.push({
          type: "api_request_failed",
          severity: "high",
          message: `API request failed (${statusCode}): ${snapshot.error || "Request error"}`
        });
      }
    } else {
      alerts.push({
        type: "api_unavailable",
        severity: "critical",
        message: `PTR API unavailable - ${snapshot.error || "Unknown failure"}`
      });
    }

    return alerts;
  }

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
      message: "No recent PTR stats available for analysis (empty stats response)"
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

  // Load previous snapshot for trend analysis (before saving current one)
  const previousSnapshot = await loadLatestReport<PTRStatsSnapshot>("ptr-stats");

  // Compare with historical data
  const comparison = comparePTRStats(snapshot, previousSnapshot);
  const trendReport = formatPTRTrendReport(comparison);

  console.log("\n" + trendReport);

  // Save current snapshot with timestamp for historical tracking
  try {
    const savedPath = await saveReport("ptr-stats", snapshot);
    console.log(`✓ PTR stats snapshot saved to: ${savedPath}`);
  } catch (error) {
    console.error("Failed to save PTR stats snapshot:", error);
    // Continue with alerting even if save fails
  }

  // Analyze for alert conditions
  const alerts = analyzePTRStats(snapshot);

  // Check bot health status for graduated outage detection
  const healthCheckPath = resolve("reports", "monitoring", "health-check-latest.json");
  if (existsSync(healthCheckPath)) {
    try {
      const healthContent = readFileSync(healthCheckPath, "utf-8");
      const healthCheck = JSON.parse(healthContent) as {
        bot_alive: boolean;
        health_status: string;
        alert_level: string;
        alert_message: string | null;
        consecutive_failures: number;
        minutes_since_last_success: number | null;
      };

      // Add bot health alerts based on graduated detection
      if (healthCheck.alert_level === "critical") {
        alerts.push({
          type: "bot_outage_critical",
          severity: "critical",
          message:
            healthCheck.alert_message ||
            `Bot unresponsive for ${healthCheck.minutes_since_last_success || "unknown"} minutes - CRITICAL`
        });
      } else if (healthCheck.alert_level === "high") {
        alerts.push({
          type: "bot_outage_high",
          severity: "high",
          message:
            healthCheck.alert_message ||
            `Bot unresponsive for ${healthCheck.minutes_since_last_success || "unknown"} minutes - HIGH priority`
        });
      }
    } catch (error) {
      console.warn("Failed to read or parse health check results:", error);
    }
  }

  // Send push notifications and email notifications for critical and high severity alerts
  for (const alert of alerts) {
    if (alert.severity === "critical" || alert.severity === "high") {
      const priority = alert.severity === "critical" ? 5 : 4;
      const runId = process.env.GITHUB_RUN_ID || "unknown";
      const repo = process.env.GITHUB_REPOSITORY || "ralphschuler/.screeps-gpt";
      const actionUrl = `https://github.com/${repo}/actions/runs/${runId}`;

      // Send push notification
      await sendPushNotification({
        title: `PTR Alert: ${alert.type}`,
        body: alert.message,
        link: actionUrl,
        priority: priority as 1 | 2 | 3 | 4 | 5
      });

      // Send email notification for critical and high severity alerts
      const emailTo = process.env.EMAIL_NOTIFY_TO;
      if (emailTo) {
        const emailSubject = `[${alert.severity.toUpperCase()}] Screeps PTR Alert: ${alert.type}`;
        const emailBody = `
Screeps PTR Alert Detected
========================

Severity: ${alert.severity.toUpperCase()}
Type: ${alert.type}
Message: ${alert.message}

View Details: ${actionUrl}

Timestamp: ${new Date().toISOString()}
Repository: ${repo}
Run ID: ${runId}

This is an automated alert from the Screeps monitoring system.
`.trim();

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: ${alert.severity === "critical" ? "#dc3545" : "#ffc107"}; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; }
    .alert-box { background-color: #f8f9fa; border-left: 4px solid ${alert.severity === "critical" ? "#dc3545" : "#ffc107"}; padding: 15px; margin: 20px 0; }
    .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #6c757d; }
    .btn { display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    td { padding: 8px; border-bottom: 1px solid #dee2e6; }
    td:first-child { font-weight: bold; width: 150px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚨 Screeps PTR Alert</h1>
  </div>
  <div class="content">
    <div class="alert-box">
      <h2>${alert.type}</h2>
      <p>${alert.message}</p>
    </div>
    <table>
      <tr><td>Severity</td><td>${alert.severity.toUpperCase()}</td></tr>
      <tr><td>Type</td><td>${alert.type}</td></tr>
      <tr><td>Timestamp</td><td>${new Date().toISOString()}</td></tr>
      <tr><td>Repository</td><td>${repo}</td></tr>
      <tr><td>Run ID</td><td>${runId}</td></tr>
    </table>
    <p style="text-align: center;">
      <a href="${actionUrl}" class="btn">View Full Details →</a>
    </p>
  </div>
  <div class="footer">
    <p>This is an automated alert from the Screeps monitoring system.</p>
    <p>Repository: <a href="https://github.com/${repo}">${repo}</a></p>
  </div>
</body>
</html>
`.trim();

        await sendEmailNotification({
          to: emailTo,
          subject: emailSubject,
          body: emailBody,
          html: emailHtml,
          priority: alert.severity === "critical" ? "high" : "normal"
        });
      }

      // Add delay between notifications to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
  }

  console.log(
    `Processed ${alerts.length} alert conditions, sent notifications for ${alerts.filter(a => a.severity === "critical" || a.severity === "high").length} critical/high alerts`
  );

  // Apply retention policy to clean up old reports
  try {
    const deletedCount = await applyRetentionPolicy("ptr-stats", {
      maxAgeDays: 30,
      minReportsToKeep: 10
    });
    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} old PTR stats report(s)`);
    }
  } catch (error) {
    console.error("Failed to apply retention policy:", error);
  }
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
