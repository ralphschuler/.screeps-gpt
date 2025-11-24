import { profile } from "@ralphschuler/screeps-profiler";
import { EnergyBalanceCalculator } from "@runtime/behavior/EnergyBalanceCalculator";
import type { EnergyBalance } from "@runtime/behavior/EnergyBalanceCalculator";

/**
 * Energy economy metrics stored in Memory for tracking and visibility
 */
export interface EnergyEconomyMetrics {
  /** Energy production per tick from harvesters */
  productionRate: number;
  /** Current energy consumption per tick from spawning */
  consumptionRate: number;
  /** Total energy storage available in room */
  storageCapacity: number;
  /** Current energy reserves (available energy) */
  currentReserves: number;
  /** Sustainability ratio (production / consumption) */
  sustainabilityRatio: number;
  /** Last update tick */
  lastUpdate: number;
  /** Number of energy sources in room */
  sourceCount: number;
  /** Recommended maximum spawn budget per creep */
  maxSpawnBudget: number;
}

/**
 * Spawn validation result
 */
export interface SpawnValidationResult {
  /** Whether spawning is allowed */
  allowed: boolean;
  /** Reason for decision */
  reason: string;
  /** Recommended maximum spawn cost */
  maxCost: number;
}

/**
 * Energy economy validator for sustainable spawning.
 * Provides validation checks and visual feedback for energy sustainability.
 */
@profile
export class EnergyValidator {
  private readonly calculator: EnergyBalanceCalculator;
  private readonly energySurplusThreshold: number;
  private readonly reserveBufferMultiplier: number;

  public constructor() {
    this.calculator = new EnergyBalanceCalculator();
    // Require 20% energy surplus before spawning expensive creeps
    this.energySurplusThreshold = 1.2;
    // Require 2x spawn cost in reserves as buffer
    this.reserveBufferMultiplier = 2;
  }

  /**
   * Assess energy economy for a room and return metrics.
   * Updates Memory with current metrics for tracking.
   *
   * @param room - Room to assess
   * @returns Energy economy metrics
   */
  public assessEnergyEconomy(room: Room): EnergyEconomyMetrics {
    const balance = this.calculator.calculate(room);

    const metrics: EnergyEconomyMetrics = {
      productionRate: balance.production,
      consumptionRate: balance.consumption,
      storageCapacity: room.energyCapacityAvailable,
      currentReserves: room.energyAvailable,
      sustainabilityRatio: balance.ratio,
      lastUpdate: Game.time,
      sourceCount: balance.sourceCount,
      maxSpawnBudget: balance.maxSpawnBudget
    };

    // Update Memory for visibility and tracking
    this.updateMemoryMetrics(room.name, metrics);

    return metrics;
  }

  /**
   * Validate if spawning a creep with given cost is sustainable.
   * Checks energy surplus and reserve requirements.
   *
   * @param room - Room to validate
   * @param spawnCost - Cost of creep to spawn
   * @returns Validation result with recommendation
   */
  public validateSpawn(room: Room, spawnCost: number): SpawnValidationResult {
    const metrics = this.assessEnergyEconomy(room);

    // Check 1: Ensure energy surplus for sustainability
    if (metrics.sustainabilityRatio < this.energySurplusThreshold) {
      return {
        allowed: false,
        reason: `Insufficient energy surplus (${metrics.sustainabilityRatio.toFixed(2)}x < ${this.energySurplusThreshold}x required)`,
        maxCost: Math.floor(metrics.maxSpawnBudget * 0.8)
      };
    }

    // Check 2: Ensure reserves can cover spawn cost + buffer
    const requiredReserves = spawnCost * this.reserveBufferMultiplier;
    if (metrics.currentReserves < requiredReserves) {
      return {
        allowed: false,
        reason: `Insufficient reserves (${metrics.currentReserves} < ${requiredReserves} required for ${spawnCost} cost creep)`,
        maxCost: Math.floor(metrics.currentReserves / this.reserveBufferMultiplier)
      };
    }

    return {
      allowed: true,
      reason: "Energy economy supports spawn",
      maxCost: metrics.maxSpawnBudget
    };
  }

  /**
   * Determine if room can afford larger, more expensive creeps.
   * This is a convenience method for spawn logic.
   *
   * @param room - Room to check
   * @param spawnCost - Cost of the creep to spawn
   * @returns True if larger creep is sustainable
   */
  public canAffordLargerCreep(room: Room, spawnCost: number): boolean {
    const result = this.validateSpawn(room, spawnCost);
    return result.allowed;
  }

  /**
   * Render visual feedback for energy economy status in room.
   * Shows sustainability ratio and status indicator.
   *
   * @param room - Room to render visuals for
   * @param position - Optional position override (default: top-left)
   */
  public renderEnergyStatus(room: Room, position?: { x: number; y: number }): void {
    const metrics = this.assessEnergyEconomy(room);

    // Determine status emoji based on sustainability ratio
    const status = this.getStatusEmoji(metrics.sustainabilityRatio);

    // Default position: top-left corner
    const x = position?.x ?? 1;
    const y = position?.y ?? 1;

    // Render status text
    room.visual.text(`${status} Energy: ${metrics.sustainabilityRatio.toFixed(2)}x`, x, y, {
      align: "left",
      font: 0.5,
      opacity: 0.8
    });

    // Add production/consumption details below
    room.visual.text(
      `↑${metrics.productionRate.toFixed(1)}/t ↓${metrics.consumptionRate.toFixed(1)}/t`,
      x,
      y + 0.6,
      {
        align: "left",
        font: 0.4,
        opacity: 0.7
      }
    );
  }

  /**
   * Get status emoji based on sustainability ratio.
   *
   * @param ratio - Sustainability ratio (production/consumption)
   * @returns Status emoji
   */
  private getStatusEmoji(ratio: number): string {
    if (ratio >= 1.5) {
      return "✅"; // Excellent: 1.5x+ production
    } else if (ratio >= 1.2) {
      return "🟢"; // Good: 1.2x+ production
    } else if (ratio >= 1.0) {
      return "🟡"; // Neutral: Balanced
    } else if (ratio >= 0.8) {
      return "🟠"; // Warning: Slight deficit
    } else {
      return "⚠️"; // Critical: Significant deficit
    }
  }

  /**
   * Update Memory with current energy metrics for tracking.
   *
   * @param roomName - Room name
   * @param metrics - Energy metrics to store
   */
  private updateMemoryMetrics(roomName: string, metrics: EnergyEconomyMetrics): void {
    Memory.rooms ??= {};
    
    const roomMemory = Memory.rooms[roomName];
    // Always preserve existing properties and update energyMetrics
    Memory.rooms[roomName] = { ...roomMemory, energyMetrics: metrics };
  }

  /**
   * Get energy balance details for debugging and analysis.
   * This exposes the underlying EnergyBalanceCalculator results.
   *
   * @param room - Room to analyze
   * @returns Detailed energy balance metrics
   */
  public getEnergyBalance(room: Room): EnergyBalance {
    return this.calculator.calculate(room);
  }
}
