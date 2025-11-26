import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { BotSnapshot } from "./types/bot-snapshot";

/**
 * Controller health status for a single room
 */
export interface ControllerHealthStatus {
  roomName: string;
  rcl: number;
  ticksToDowngrade: number;
  hoursToDowngrade: number;
  alertLevel: "none" | "info" | "warning" | "critical";
  alertMessage: string | null;
  controllerProgress?: number;
  controllerProgressTotal?: number;
  progressPercent?: number;
  upgraderCount: number;
  energyAvailable: number;
  energyCapacity: number;
}

/**
 * Overall controller health report
 */
export interface ControllerHealthReport {
  timestamp: string;
  totalRooms: number;
  alertCounts: {
    info: number;
    warning: number;
    critical: number;
  };
  rooms: ControllerHealthStatus[];
}

/**
 * Maximum downgrade timer by RCL (in ticks)
 * Source: https://docs.screeps.com/control.html#Downgrade
 */
const MAX_DOWNGRADE_TIMER: Record<number, number> = {
  1: 20000,
  2: 10000,
  3: 20000,
  4: 40000,
  5: 80000,
  6: 120000,
  7: 150000,
  8: 200000
};

/**
 * Default fallback timer when RCL is unknown
 */
const DEFAULT_DOWNGRADE_TIMER = 20000;

/**
 * Controller progress thresholds for downgrade estimation
 */
const PROGRESS_THRESHOLDS = {
  wellMaintained: 50, // > 50% progress
  moderatelyMaintained: 25, // 25-50% progress
  poorlyMaintained: 10, // 10-25% progress
  atRisk: 0 // < 10% progress
};

/**
 * Downgrade timer multipliers based on progress
 */
const TIMER_MULTIPLIERS = {
  wellMaintained: 0.9,
  moderatelyMaintained: 0.7,
  poorlyMaintained: 0.5,
  atRisk: 0.3
};

/**
 * Creep role name constants
 */
const ROLE_UPGRADER = "upgrader";

/**
 * Alert thresholds in hours
 */
const ALERT_THRESHOLDS = {
  critical: 12, // 12 hours
  warning: 24, // 24 hours
  info: 48 // 48 hours
};

/**
 * Ticks per hour (1 tick ≈ 1.33 seconds on average)
 * 3600 seconds per hour / 1.33 ≈ 2700 ticks per hour
 */
const TICKS_PER_HOUR = 2700;

/**
 * Convert ticks to hours (assuming 1 tick = ~1.33 seconds on average)
 * @param ticks Number of ticks
 * @returns Hours
 */
function ticksToHours(ticks: number): number {
  return ticks / TICKS_PER_HOUR;
}

/**
 * Determine alert level based on hours until downgrade
 * @param hours Hours until downgrade
 * @returns Alert level
 */
function determineAlertLevel(hours: number): "none" | "info" | "warning" | "critical" {
  if (hours < ALERT_THRESHOLDS.critical) {
    return "critical";
  } else if (hours < ALERT_THRESHOLDS.warning) {
    return "warning";
  } else if (hours < ALERT_THRESHOLDS.info) {
    return "info";
  }
  return "none";
}

/**
 * Generate alert message based on controller status
 * @param status Controller health status
 * @returns Alert message or null
 */
function generateAlertMessage(status: ControllerHealthStatus): string | null {
  if (status.alertLevel === "none") {
    return null;
  }

  const timeStr = `${status.hoursToDowngrade.toFixed(1)}h (${status.ticksToDowngrade} ticks)`;
  const progressStr =
    status.progressPercent !== undefined ? ` [${status.progressPercent.toFixed(1)}% to next level]` : "";

  return `Room ${status.roomName} RCL${status.rcl} controller will downgrade in ${timeStr}${progressStr}. Upgraders: ${status.upgraderCount}, Energy: ${status.energyAvailable}/${status.energyCapacity}`;
}

/**
 * Analyze controller health from bot snapshot
 * @param snapshot Bot snapshot data
 * @returns Controller health report
 */
export function analyzeControllerHealth(snapshot: BotSnapshot): ControllerHealthReport {
  const timestamp = new Date().toISOString();
  const rooms: ControllerHealthStatus[] = [];

  const alertCounts = {
    info: 0,
    warning: 0,
    critical: 0
  };

  // Analyze each room
  if (snapshot.rooms) {
    for (const [roomName, roomData] of Object.entries(snapshot.rooms)) {
      const rcl = roomData.rcl;

      // Skip RCL 0 or 1 (no downgrade risk at RCL 1)
      if (rcl <= 1) {
        continue;
      }

      // Use actual ticksToDowngrade if available, otherwise estimate
      let actualTicksToDowngrade: number;

      if (roomData.ticksToDowngrade !== undefined && roomData.ticksToDowngrade > 0) {
        // We have the actual value from the game
        actualTicksToDowngrade = roomData.ticksToDowngrade;
      } else {
        // Estimate based on progress if actual value not available
        const maxTimer = MAX_DOWNGRADE_TIMER[rcl] || DEFAULT_DOWNGRADE_TIMER;

        if (roomData.controllerProgress !== undefined && roomData.controllerProgressTotal !== undefined) {
          const progressPercent = (roomData.controllerProgress / roomData.controllerProgressTotal) * 100;

          // If controller has made progress, assume it's being maintained
          // Scale downgrade timer based on how much progress has been made
          if (progressPercent > PROGRESS_THRESHOLDS.wellMaintained) {
            actualTicksToDowngrade = maxTimer * TIMER_MULTIPLIERS.wellMaintained;
          } else if (progressPercent > PROGRESS_THRESHOLDS.moderatelyMaintained) {
            actualTicksToDowngrade = maxTimer * TIMER_MULTIPLIERS.moderatelyMaintained;
          } else if (progressPercent > PROGRESS_THRESHOLDS.poorlyMaintained) {
            actualTicksToDowngrade = maxTimer * TIMER_MULTIPLIERS.poorlyMaintained;
          } else {
            actualTicksToDowngrade = maxTimer * TIMER_MULTIPLIERS.atRisk;
          }
        } else {
          // No data available, use max timer as safe default
          actualTicksToDowngrade = maxTimer;
        }
      }

      const hoursToDowngrade = ticksToHours(actualTicksToDowngrade);
      const alertLevel = determineAlertLevel(hoursToDowngrade);

      // Count upgraders from creeps data
      let upgraderCount = 0;
      if (snapshot.creeps && snapshot.creeps.byRole) {
        upgraderCount = snapshot.creeps.byRole[ROLE_UPGRADER] || 0;
      }

      const status: ControllerHealthStatus = {
        roomName,
        rcl,
        ticksToDowngrade: actualTicksToDowngrade,
        hoursToDowngrade,
        alertLevel,
        alertMessage: null,
        controllerProgress: roomData.controllerProgress,
        controllerProgressTotal: roomData.controllerProgressTotal,
        progressPercent:
          roomData.controllerProgress !== undefined && roomData.controllerProgressTotal !== undefined
            ? (roomData.controllerProgress / roomData.controllerProgressTotal) * 100
            : undefined,
        upgraderCount,
        energyAvailable: roomData.energy,
        energyCapacity: roomData.energyCapacity
      };

      status.alertMessage = generateAlertMessage(status);

      if (alertLevel === "info") alertCounts.info++;
      if (alertLevel === "warning") alertCounts.warning++;
      if (alertLevel === "critical") alertCounts.critical++;

      rooms.push(status);
    }
  }

  return {
    timestamp,
    totalRooms: rooms.length,
    alertCounts,
    rooms
  };
}

/**
 * Load bot snapshot from file
 * @returns Bot snapshot or null if not found
 */
function loadBotSnapshot(): BotSnapshot | null {
  // Try to find the latest snapshot
  const snapshotsDir = resolve("reports", "bot-snapshots");

  if (!existsSync(snapshotsDir)) {
    return null;
  }

  // Look for today's snapshot first
  const today = new Date().toISOString().split("T")[0];
  const todaySnapshotPath = resolve(snapshotsDir, `snapshot-${today}.json`);

  if (existsSync(todaySnapshotPath)) {
    try {
      const content = readFileSync(todaySnapshotPath, "utf-8");
      return JSON.parse(content) as BotSnapshot;
    } catch (error) {
      console.warn("Failed to parse today's snapshot:", error);
    }
  }

  return null;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log("Checking controller health...\n");

  const snapshot = loadBotSnapshot();

  if (!snapshot) {
    console.log("No bot snapshot found, skipping controller health check");
    return;
  }

  const report = analyzeControllerHealth(snapshot);

  console.log("=== Controller Health Report ===");
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Total Rooms Analyzed: ${report.totalRooms}`);
  console.log(
    `Alerts: ${report.alertCounts.critical} critical, ${report.alertCounts.warning} warning, ${report.alertCounts.info} info\n`
  );

  // Display each room status
  for (const room of report.rooms) {
    if (room.alertLevel !== "none") {
      const emoji = room.alertLevel === "critical" ? "🚨" : room.alertLevel === "warning" ? "⚠️" : "ℹ️";
      console.log(`${emoji} [${room.alertLevel.toUpperCase()}] ${room.alertMessage}`);
    } else {
      console.log(
        `✅ Room ${room.roomName} RCL${room.rcl}: Healthy (~${room.hoursToDowngrade.toFixed(0)}h to downgrade)`
      );
    }
  }

  // Exit with appropriate code
  if (report.alertCounts.critical > 0) {
    console.log("\n❌ CRITICAL controller health issues detected");
    process.exit(2);
  } else if (report.alertCounts.warning > 0) {
    console.log("\n⚠️  WARNING controller health issues detected");
    process.exit(1);
  } else if (report.alertCounts.info > 0) {
    console.log("\nℹ️  INFO controller health notices");
    process.exit(0);
  } else {
    console.log("\n✅ All controllers healthy");
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Unexpected error:", error);
    process.exit(2);
  });
}

export {
  ALERT_THRESHOLDS,
  MAX_DOWNGRADE_TIMER,
  TICKS_PER_HOUR,
  DEFAULT_DOWNGRADE_TIMER,
  PROGRESS_THRESHOLDS,
  TIMER_MULTIPLIERS,
  ROLE_UPGRADER,
  ticksToHours,
  determineAlertLevel
};
