import type { GameContext } from "@runtime/types/GameContext";
import type { HealthStatus } from "./HealthMonitor";

/**
 * Warning types for early detection
 */
export enum WarningType {
  WORKFORCE_DEPLETION = "WORKFORCE_DEPLETION",
  ENERGY_STARVATION = "ENERGY_STARVATION",
  SPAWN_IDLE = "SPAWN_IDLE",
  CONTROLLER_DOWNGRADE = "CONTROLLER_DOWNGRADE",
  NO_HARVESTERS = "NO_HARVESTERS"
}

/**
 * Warning with severity and details
 */
export interface HealthWarning {
  type: WarningType;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
}

/**
 * Configuration for warning thresholds
 */
export interface WarningConfig {
  /** Minimum harvester count before warning (default: 2) */
  minHarvesters?: number;
  /** Energy threshold for starvation warning (default: 300) */
  energyStarvationThreshold?: number;
  /** Controller downgrade safety margin in ticks (default: 5000) */
  controllerDowngradeMargin?: number;
}

/**
 * Detects early warning signs of bot health degradation.
 *
 * Warning detection includes:
 * - Workforce depletion (harvester count trending to zero)
 * - Energy starvation (storage + available < spawn cost)
 * - Spawn utilization (idle spawn with queued creeps)
 * - Controller downgrade risk (time to downgrade < safety margin)
 */
export class WarningDetector {
  private readonly config: Required<WarningConfig>;
  private readonly logger: Pick<Console, "log" | "warn">;

  public constructor(config: WarningConfig = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.config = {
      minHarvesters: config.minHarvesters ?? 2,
      energyStarvationThreshold: config.energyStarvationThreshold ?? 300,
      controllerDowngradeMargin: config.controllerDowngradeMargin ?? 5000
    };
    this.logger = logger;
  }

  /**
   * Detect all current warnings based on game state and health status
   */
  public detectWarnings(game: GameContext, memory: Memory, _healthStatus: HealthStatus): HealthWarning[] {
    const warnings: HealthWarning[] = [];

    // Check for harvester depletion
    const harvesterWarning = this.checkHarvesterCount(game);
    if (harvesterWarning) {
      warnings.push(harvesterWarning);
    }

    // Check for energy starvation
    const energyWarning = this.checkEnergyStarvation(game);
    if (energyWarning) {
      warnings.push(energyWarning);
    }

    // Check for idle spawns
    const spawnWarning = this.checkIdleSpawns(game, memory);
    if (spawnWarning) {
      warnings.push(spawnWarning);
    }

    // Check for controller downgrade risk
    const controllerWarnings = this.checkControllerDowngrade(game);
    warnings.push(...controllerWarnings);

    return warnings;
  }

  /**
   * Check if harvester count is below safe threshold
   */
  private checkHarvesterCount(game: GameContext): HealthWarning | null {
    let harvesterCount = 0;
    for (const creepName in game.creeps) {
      const creep = game.creeps[creepName];
      if (creep.memory?.role === "harvester") {
        harvesterCount++;
      }
    }

    if (harvesterCount === 0) {
      return {
        type: WarningType.NO_HARVESTERS,
        severity: "critical",
        message: `No harvesters available - energy production stopped`,
        timestamp: game.time
      };
    } else if (harvesterCount < this.config.minHarvesters) {
      return {
        type: WarningType.WORKFORCE_DEPLETION,
        severity: "warning",
        message: `Only ${harvesterCount} harvester(s) remaining (minimum: ${this.config.minHarvesters})`,
        timestamp: game.time
      };
    }

    return null;
  }

  /**
   * Check if energy is below starvation threshold
   */
  private checkEnergyStarvation(game: GameContext): HealthWarning | null {
    let totalEnergy = 0;
    let roomCount = 0;

    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room.controller?.my) {
        totalEnergy += room.energyAvailable;
        roomCount++;
      }
    }

    if (roomCount > 0 && totalEnergy < this.config.energyStarvationThreshold) {
      return {
        type: WarningType.ENERGY_STARVATION,
        severity: "warning",
        message: `Low energy: ${totalEnergy} available (threshold: ${this.config.energyStarvationThreshold})`,
        timestamp: game.time
      };
    }

    return null;
  }

  /**
   * Check if spawns are idle when there might be work to do
   */
  private checkIdleSpawns(game: GameContext, memory: Memory): HealthWarning | null {
    const spawns = Object.values(game.spawns);
    let idleSpawns = 0;
    let totalSpawns = 0;

    for (const spawn of spawns) {
      totalSpawns++;
      if (!spawn.spawning) {
        idleSpawns++;
      }
    }

    // Check if we have spawn queue data in memory
    const spawnQueue = memory.spawnQueue as unknown[] | undefined;
    const hasSpawnQueue = Array.isArray(spawnQueue) && spawnQueue.length > 0;

    if (idleSpawns === totalSpawns && totalSpawns > 0 && hasSpawnQueue) {
      return {
        type: WarningType.SPAWN_IDLE,
        severity: "info",
        message: `All spawns idle with ${spawnQueue.length} queued spawn(s)`,
        timestamp: game.time
      };
    }

    return null;
  }

  /**
   * Check if any controllers are at risk of downgrading
   */
  private checkControllerDowngrade(game: GameContext): HealthWarning[] {
    const warnings: HealthWarning[] = [];

    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room.controller?.my && room.controller.level > 1) {
        const ticksToDowngrade = room.controller.ticksToDowngrade ?? 0;
        if (ticksToDowngrade < this.config.controllerDowngradeMargin) {
          warnings.push({
            type: WarningType.CONTROLLER_DOWNGRADE,
            severity: ticksToDowngrade < this.config.controllerDowngradeMargin / 2 ? "critical" : "warning",
            message: `${roomName} controller will downgrade in ${ticksToDowngrade} ticks`,
            timestamp: game.time
          });
        }
      }
    }

    return warnings;
  }

  /**
   * Log warnings to console
   */
  public logWarnings(warnings: HealthWarning[]): void {
    for (const warning of warnings) {
      const logFn = warning.severity === "critical" ? this.logger.warn : this.logger.log;
      logFn?.(`[WarningDetector] ${warning.severity.toUpperCase()}: ${warning.message}`);
    }
  }
}
