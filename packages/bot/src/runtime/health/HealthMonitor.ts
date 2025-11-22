import type { GameContext } from "@runtime/types/GameContext";

/**
 * Health state classification for bot operation
 */
export enum HealthState {
  HEALTHY = "HEALTHY", // 80-100: Normal operations
  DEGRADED = "DEGRADED", // 60-79: Early warning, non-essential tasks paused
  CRITICAL = "CRITICAL", // 40-59: Recovery mode, emergency spawn priority
  EMERGENCY = "EMERGENCY" // 0-39: Full recovery protocol, only harvester spawning
}

/**
 * Health metrics breakdown by category
 */
export interface HealthMetrics {
  workforce: number; // 0-40 points
  energy: number; // 0-30 points
  spawn: number; // 0-20 points
  infrastructure: number; // 0-10 points
}

/**
 * Complete health status with score and state
 */
export interface HealthStatus {
  score: number; // 0-100
  state: HealthState;
  metrics: HealthMetrics;
  timestamp: number;
}

/**
 * Configuration for health scoring thresholds
 */
export interface HealthConfig {
  /** Target workforce count for full health (default: 10) */
  targetCreepCount?: number;
  /** Energy threshold for full health (default: 1000) */
  energyTarget?: number;
}

/**
 * Monitors bot health across multiple dimensions and calculates health scores.
 * 
 * Health scoring algorithm:
 * - workforceHealth: min(creepCount / targetCount, 1.0) * 40
 * - energyHealth: min(availableEnergy / energyTarget, 1.0) * 30
 * - spawnHealth: (activeSpawns / totalSpawns) * 20
 * - infrastructureHealth: (criticalStructures / required) * 10
 * 
 * State transitions:
 * - HEALTHY (80-100): Normal operations
 * - DEGRADED (60-79): Early warning, non-essential tasks paused
 * - CRITICAL (40-59): Recovery mode, emergency spawn priority
 * - EMERGENCY (0-39): Full recovery protocol, only harvester spawning
 */
export class HealthMonitor {
  private readonly config: Required<HealthConfig>;
  private readonly logger: Pick<Console, "log" | "warn">;
  private lastHealthScore: number = 100;

  public constructor(config: HealthConfig = {}, logger: Pick<Console, "log" | "warn"> = console) {
    this.config = {
      targetCreepCount: config.targetCreepCount ?? 10,
      energyTarget: config.energyTarget ?? 1000
    };
    this.logger = logger;
  }

  /**
   * Calculate current health status for all rooms
   */
  public calculateHealth(game: GameContext, _memory: Memory): HealthStatus {
    const metrics: HealthMetrics = {
      workforce: this.calculateWorkforceHealth(game),
      energy: this.calculateEnergyHealth(game),
      spawn: this.calculateSpawnHealth(game),
      infrastructure: this.calculateInfrastructureHealth(game)
    };

    const score = metrics.workforce + metrics.energy + metrics.spawn + metrics.infrastructure;
    const state = this.determineHealthState(score);

    // Log state transitions
    if (this.lastHealthScore >= 80 && score < 80) {
      this.logger.warn?.(`[HealthMonitor] Health degraded: ${this.lastHealthScore.toFixed(1)} -> ${score.toFixed(1)} (${state})`);
    } else if (this.lastHealthScore >= 60 && score < 60) {
      this.logger.warn?.(`[HealthMonitor] Health critical: ${this.lastHealthScore.toFixed(1)} -> ${score.toFixed(1)} (${state})`);
    } else if (this.lastHealthScore >= 40 && score < 40) {
      this.logger.warn?.(`[HealthMonitor] Health emergency: ${this.lastHealthScore.toFixed(1)} -> ${score.toFixed(1)} (${state})`);
    } else if (this.lastHealthScore < 80 && score >= 80) {
      this.logger.log?.(`[HealthMonitor] Health restored: ${this.lastHealthScore.toFixed(1)} -> ${score.toFixed(1)} (${state})`);
    }

    this.lastHealthScore = score;

    return {
      score,
      state,
      metrics,
      timestamp: game.time
    };
  }

  /**
   * Calculate workforce health based on creep count
   * Returns 0-40 points based on current vs target workforce
   */
  private calculateWorkforceHealth(game: GameContext): number {
    const creepCount = Object.keys(game.creeps).length;
    const ratio = Math.min(creepCount / this.config.targetCreepCount, 1.0);
    return ratio * 40;
  }

  /**
   * Calculate energy health based on available energy
   * Returns 0-30 points based on energy availability across all rooms
   */
  private calculateEnergyHealth(game: GameContext): number {
    let totalEnergy = 0;
    let roomCount = 0;

    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room.controller?.my) {
        totalEnergy += room.energyAvailable;
        // Add storage energy if available
        const structures = room.find?.(FIND_MY_STRUCTURES);
        if (structures) {
          for (const structure of structures) {
            if ((structure as StructureStorage).structureType === STRUCTURE_STORAGE) {
              const storage = structure as StructureStorage;
              totalEnergy += storage.store?.[RESOURCE_ENERGY] ?? 0;
            }
          }
        }
        roomCount++;
      }
    }

    if (roomCount === 0) {
      return 0;
    }

    const ratio = Math.min(totalEnergy / this.config.energyTarget, 1.0);
    return ratio * 30;
  }

  /**
   * Calculate spawn health based on spawn availability and utilization
   * Returns 0-20 points based on spawn count and operational status
   */
  private calculateSpawnHealth(game: GameContext): number {
    const spawns = Object.values(game.spawns);
    if (spawns.length === 0) {
      return 0;
    }

    // All existing spawns contribute to health (existence check only)
    // Having spawns available is what matters for recovery, not utilization
    return 20;
  }

  /**
   * Calculate infrastructure health based on critical structures
   * Returns 0-10 points based on controller level and critical structures
   */
  private calculateInfrastructureHealth(game: GameContext): number {
    let totalHealth = 0;
    let roomCount = 0;

    for (const roomName in game.rooms) {
      const room = game.rooms[roomName];
      if (room.controller?.my) {
        roomCount++;
        // Controller level contributes to infrastructure health
        const controllerHealth = (room.controller.level / 8) * 5;
        
        // Check for critical structures (spawns)
        const spawns = Object.values(game.spawns).filter(s => s.room?.name === roomName);
        const spawnHealth = spawns.length > 0 ? 5 : 0;
        
        totalHealth += controllerHealth + spawnHealth;
      }
    }

    if (roomCount === 0) {
      return 0;
    }

    // Average across all rooms, max 10 points
    return Math.min((totalHealth / roomCount), 10);
  }

  /**
   * Determine health state based on score
   */
  private determineHealthState(score: number): HealthState {
    if (score >= 80) {
      return HealthState.HEALTHY;
    } else if (score >= 60) {
      return HealthState.DEGRADED;
    } else if (score >= 40) {
      return HealthState.CRITICAL;
    } else {
      return HealthState.EMERGENCY;
    }
  }

  /**
   * Get a human-readable status message
   */
  public getStatusMessage(status: HealthStatus): string {
    const { score, state, metrics } = status;
    return `Health: ${score.toFixed(1)}/100 (${state}) - Workforce: ${metrics.workforce.toFixed(1)}, Energy: ${metrics.energy.toFixed(1)}, Spawn: ${metrics.spawn.toFixed(1)}, Infrastructure: ${metrics.infrastructure.toFixed(1)}`;
  }
}
