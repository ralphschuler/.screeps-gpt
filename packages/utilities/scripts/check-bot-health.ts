import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { checkBotAliveness } from "./check-bot-aliveness.js";
import type { PTRStatsSnapshot } from "./check-ptr-alerts.js";

/**
 * Health status levels
 */
type HealthStatus = "operational" | "degraded" | "critical";

/**
 * Persistent health state tracking
 */
interface HealthState {
  last_successful_ping: string | null;
  last_failed_ping: string | null;
  consecutive_failures: number;
  health_status: HealthStatus;
  last_known_tick: number | null;
  last_bot_status: string | null;
  detection_history: Array<{
    timestamp: string;
    status: "success" | "failure";
    aliveness?: string;
    error?: string;
  }>;
}

/**
 * Health check result with graduated detection
 */
interface HealthCheckResult {
  timestamp: string;
  bot_alive: boolean;
  health_status: HealthStatus;
  consecutive_failures: number;
  minutes_since_last_success: number | null;
  alert_level: "none" | "warning" | "high" | "critical";
  alert_message: string | null;
  stage_results: {
    ptr_stats: {
      checked: boolean;
      has_data: boolean;
      source?: string;
    };
    bot_aliveness: {
      checked: boolean;
      aliveness?: string;
      error?: string;
    };
    console_fallback: {
      checked: boolean;
      success?: boolean;
    };
  };
}

/**
 * Load health state from persistent storage
 */
function loadHealthState(): HealthState {
  const healthPath = resolve("reports", "monitoring", "health.json");

  if (!existsSync(healthPath)) {
    return {
      last_successful_ping: null,
      last_failed_ping: null,
      consecutive_failures: 0,
      health_status: "operational",
      last_known_tick: null,
      last_bot_status: null,
      detection_history: []
    };
  }

  try {
    const content = readFileSync(healthPath, "utf-8");
    return JSON.parse(content) as HealthState;
  } catch (error) {
    console.warn("Failed to load health state, using default:", error);
    return {
      last_successful_ping: null,
      last_failed_ping: null,
      consecutive_failures: 0,
      health_status: "operational",
      last_known_tick: null,
      last_bot_status: null,
      detection_history: []
    };
  }
}

/**
 * Save health state to persistent storage
 */
function saveHealthState(state: HealthState): void {
  const healthDir = resolve("reports", "monitoring");
  mkdirSync(healthDir, { recursive: true });

  const healthPath = resolve(healthDir, "health.json");
  writeFileSync(healthPath, JSON.stringify(state, null, 2));
}

/**
 * Check Stage 1: PTR Stats validation
 */
function checkPTRStats(): {
  has_data: boolean;
  source?: string;
  last_tick?: number;
} {
  const statsPath = resolve("reports", "screeps-stats", "latest.json");

  if (!existsSync(statsPath)) {
    console.log("  Stage 1: PTR stats file not found");
    return { has_data: false };
  }

  try {
    const content = readFileSync(statsPath, "utf-8");
    const snapshot = JSON.parse(content) as PTRStatsSnapshot;

    // Check if we have actual stats data
    const hasStats = snapshot.payload?.stats && Object.keys(snapshot.payload.stats).length > 0;

    if (hasStats) {
      const ticks = Object.keys(snapshot.payload.stats).sort();
      const lastTick = ticks.length > 0 ? Number(ticks[ticks.length - 1]) : undefined;

      console.log(
        `  Stage 1: ✅ PTR stats available (source: ${snapshot.source || "unknown"}, last tick: ${lastTick || "unknown"})`
      );
      return {
        has_data: true,
        source: snapshot.source,
        last_tick: lastTick
      };
    } else {
      console.log("  Stage 1: ⚠️  PTR stats file exists but contains no data");
      return { has_data: false };
    }
  } catch (error) {
    console.log("  Stage 1: ⚠️  Failed to parse PTR stats:", error);
    return { has_data: false };
  }
}

/**
 * Check Stage 2: Bot aliveness via world-status API
 */
async function checkBotAlivenessStage(): Promise<{
  alive: boolean;
  aliveness?: string;
  error?: string;
}> {
  try {
    console.log("  Stage 2: Checking bot aliveness via world-status API...");
    const result = await checkBotAliveness();

    if (result.aliveness === "active") {
      console.log("  Stage 2: ✅ Bot is active and executing");
      return { alive: true, aliveness: result.aliveness };
    } else if (result.aliveness === "respawn_needed" || result.aliveness === "spawn_placement_needed") {
      console.log(`  Stage 2: ⚠️  Bot needs intervention: ${result.aliveness}`);
      return { alive: false, aliveness: result.aliveness };
    } else {
      console.log(`  Stage 2: ❌ Bot status unknown: ${result.error || "Unknown error"}`);
      return {
        alive: false,
        aliveness: result.aliveness,
        error: result.error
      };
    }
  } catch (error) {
    console.log("  Stage 2: ❌ Failed to check bot aliveness:", error);
    return {
      alive: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Calculate minutes since last successful ping
 */
function calculateMinutesSinceSuccess(lastSuccess: string | null): number | null {
  if (!lastSuccess) {
    return null;
  }

  const now = new Date();
  const last = new Date(lastSuccess);
  const diffMs = now.getTime() - last.getTime();
  return Math.floor(diffMs / 60000); // Convert to minutes
}

/**
 * Determine alert level based on consecutive failures and time
 */
function determineAlertLevel(
  consecutiveFailures: number,
  minutesSinceSuccess: number | null
): {
  level: "none" | "warning" | "high" | "critical";
  message: string | null;
} {
  if (consecutiveFailures === 0) {
    return { level: "none", message: null };
  }

  // If we don't have a last success time, allow graceful initialization (first run)
  if (minutesSinceSuccess === null) {
    return {
      level: "warning",
      message: "Bot health check failing (first run - no successful ping history, graceful initialization)"
    };
  }

  // 0-15 minutes: No alert (normal fluctuation)
  if (minutesSinceSuccess < 15) {
    return {
      level: "none",
      message: null
    };
  }

  // 15-30 minutes: Warning logged
  if (minutesSinceSuccess < 30) {
    return {
      level: "warning",
      message: `Bot unresponsive for ${minutesSinceSuccess} minutes (${consecutiveFailures} consecutive failures)`
    };
  }

  // 30-60 minutes: HIGH priority
  if (minutesSinceSuccess < 60) {
    return {
      level: "high",
      message: `Bot unresponsive for ${minutesSinceSuccess} minutes - HIGH priority intervention needed`
    };
  }

  // 60+ minutes: CRITICAL priority
  return {
    level: "critical",
    message: `Bot unresponsive for ${minutesSinceSuccess} minutes - CRITICAL: manual intervention required`
  };
}

/**
 * Main health check with graduated detection
 */
async function performHealthCheck(): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  console.log(`\n🏥 Starting bot health check at ${timestamp}\n`);

  // Load persistent health state
  const healthState = loadHealthState();

  // Initialize result
  const result: HealthCheckResult = {
    timestamp,
    bot_alive: false,
    health_status: "operational",
    consecutive_failures: healthState.consecutive_failures,
    minutes_since_last_success: calculateMinutesSinceSuccess(healthState.last_successful_ping),
    alert_level: "none",
    alert_message: null,
    stage_results: {
      ptr_stats: { checked: true, has_data: false },
      bot_aliveness: { checked: false },
      console_fallback: { checked: false }
    }
  };

  // Stage 1: PTR Stats (fast, cached)
  console.log("Stage 1: PTR Stats Validation");
  const ptrResult = checkPTRStats();
  result.stage_results.ptr_stats = {
    checked: true,
    has_data: ptrResult.has_data,
    source: ptrResult.source
  };

  if (ptrResult.has_data) {
    // Bot is alive - PTR stats are being generated
    console.log("✅ Bot is operational (PTR stats available)\n");
    result.bot_alive = true;
    result.health_status = "operational";

    // Update health state
    healthState.last_successful_ping = timestamp;
    healthState.consecutive_failures = 0;
    healthState.health_status = "operational";
    if (ptrResult.last_tick) {
      healthState.last_known_tick = ptrResult.last_tick;
    }
    healthState.detection_history.push({
      timestamp,
      status: "success",
      aliveness: "active"
    });

    // Trim history to last 100 entries
    if (healthState.detection_history.length > 100) {
      healthState.detection_history = healthState.detection_history.slice(-100);
    }

    saveHealthState(healthState);
    return result;
  }

  // Stage 2: Bot Aliveness Check (1 minute timeout)
  console.log("\nStage 2: Bot Aliveness Check (world-status API)");
  result.stage_results.bot_aliveness.checked = true;

  const alivenessResult = await checkBotAlivenessStage();
  result.stage_results.bot_aliveness.aliveness = alivenessResult.aliveness;
  result.stage_results.bot_aliveness.error = alivenessResult.error;

  if (alivenessResult.alive) {
    // Bot is alive according to world-status API
    console.log("✅ Bot is operational (world-status: active)\n");
    result.bot_alive = true;
    result.health_status = "operational";

    // Update health state
    healthState.last_successful_ping = timestamp;
    healthState.consecutive_failures = 0;
    healthState.health_status = "operational";
    healthState.last_bot_status = alivenessResult.aliveness;
    healthState.detection_history.push({
      timestamp,
      status: "success",
      aliveness: alivenessResult.aliveness
    });

    // Trim history
    if (healthState.detection_history.length > 100) {
      healthState.detection_history = healthState.detection_history.slice(-100);
    }

    saveHealthState(healthState);
    return result;
  }

  // Bot appears to be down - increment failure counter
  console.log("\n❌ Bot health check failed - both PTR stats and aliveness check unsuccessful\n");
  healthState.consecutive_failures++;
  healthState.last_failed_ping = timestamp;
  healthState.last_bot_status = alivenessResult.aliveness;
  healthState.detection_history.push({
    timestamp,
    status: "failure",
    aliveness: alivenessResult.aliveness,
    error: alivenessResult.error
  });

  // Trim history
  if (healthState.detection_history.length > 100) {
    healthState.detection_history = healthState.detection_history.slice(-100);
  }

  result.consecutive_failures = healthState.consecutive_failures;
  result.minutes_since_last_success = calculateMinutesSinceSuccess(healthState.last_successful_ping);

  // Determine graduated alert level
  const alertInfo = determineAlertLevel(healthState.consecutive_failures, result.minutes_since_last_success);

  result.alert_level = alertInfo.level;
  result.alert_message = alertInfo.message;

  // Update health status based on alert level
  if (alertInfo.level === "critical") {
    result.health_status = "critical";
    healthState.health_status = "critical";
  } else if (alertInfo.level === "high" || alertInfo.level === "warning") {
    result.health_status = "degraded";
    healthState.health_status = "degraded";
  }

  saveHealthState(healthState);

  // Log alert information
  if (alertInfo.message) {
    console.log(`⚠️  Alert Level: ${alertInfo.level.toUpperCase()}`);
    console.log(`   ${alertInfo.message}`);
  }

  return result;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const result = await performHealthCheck();

  // Save result to reports
  const outputDir = resolve("reports", "monitoring");
  mkdirSync(outputDir, { recursive: true });
  const resultPath = resolve(outputDir, "health-check-latest.json");

  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  console.log(`\n💾 Health check result saved to: ${resultPath}`);

  // Print summary
  console.log("\n=== Bot Health Summary ===");
  console.log(`Status: ${result.health_status.toUpperCase()}`);
  console.log(`Bot Alive: ${result.bot_alive ? "YES" : "NO"}`);
  console.log(`Consecutive Failures: ${result.consecutive_failures}`);
  console.log(`Minutes Since Last Success: ${result.minutes_since_last_success ?? "N/A"}`);
  console.log(`Alert Level: ${result.alert_level.toUpperCase()}`);
  if (result.alert_message) {
    console.log(`Alert Message: ${result.alert_message}`);
  }

  // Exit with appropriate code
  // 0 = bot is healthy
  // 1 = bot is degraded or warning level
  // 2 = bot is critical
  if (result.health_status === "operational" && result.bot_alive) {
    process.exit(0);
  } else if (result.health_status === "degraded" || result.alert_level === "warning") {
    process.exit(1);
  } else {
    process.exit(2);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(2);
  });
}

export { performHealthCheck, loadHealthState, saveHealthState };
export type { HealthState, HealthCheckResult, HealthStatus };
