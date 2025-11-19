import { profile } from "@ralphschuler/screeps-profiler";

/**
 * Energy balance metrics for a room
 */
export interface EnergyBalance {
  /** Total energy production per tick from all sources */
  production: number;
  /** Current energy consumption per tick from spawning */
  consumption: number;
  /** Net energy balance (production - consumption) */
  balance: number;
  /** Ratio of production to consumption (production / consumption) */
  ratio: number;
  /** Recommended maximum spawn budget per creep */
  maxSpawnBudget: number;
  /** Number of energy sources in room */
  sourceCount: number;
  /** Number of active harvesters */
  harvesterCount: number;
  /** Harvester efficiency (0-1, based on coverage) */
  harvesterEfficiency: number;
}

/**
 * Calculates energy production/consumption balance for sustainable spawning.
 * Provides recommendations for spawn budgets based on room's energy economy.
 *
 * @example
 * ```ts
 * const calculator = new EnergyBalanceCalculator();
 * const balance = calculator.calculate(room);
 * console.log(`Energy balance: ${balance.balance} energy/tick`);
 * console.log(`Max spawn budget: ${balance.maxSpawnBudget} energy`);
 * ```
 */
@profile
export class EnergyBalanceCalculator {
  /** Energy regeneration per source per tick */
  private readonly ENERGY_PER_SOURCE_TICK = 10;

  /** Target energy surplus ratio to maintain (20% buffer) */
  private readonly TARGET_SURPLUS_RATIO = 0.8;

  /** Minimum harvester efficiency for production calculation */
  private readonly MIN_HARVESTER_EFFICIENCY = 0.5;

  /**
   * Calculate energy balance for a room.
   * Returns production/consumption metrics and recommended spawn budget.
   *
   * @param room - Room to analyze
   * @returns Energy balance metrics
   */
  public calculate(room: Room): EnergyBalance {
    const sourceCount = this.countSources(room);
    const harvesterCount = this.countHarvesters(room);
    const harvesterEfficiency = this.calculateHarvesterEfficiency(sourceCount, harvesterCount);
    const production = this.calculateProduction(sourceCount, harvesterEfficiency);
    const consumption = this.estimateConsumption(room);
    const balance = production - consumption;
    const ratio = consumption > 0 ? production / consumption : Infinity;
    const maxSpawnBudget = this.calculateMaxSpawnBudget(production, room);

    return {
      production,
      consumption,
      balance,
      ratio,
      maxSpawnBudget,
      sourceCount,
      harvesterCount,
      harvesterEfficiency
    };
  }

  /**
   * Count energy sources in room.
   */
  private countSources(room: Room): number {
    if (!room || typeof room.find !== "function") {
      return 0;
    }
    const sources = room.find(FIND_SOURCES);
    return sources.length;
  }

  /**
   * Count active harvesters in room.
   */
  private countHarvesters(room: Room): number {
    if (!room || typeof room.find !== "function") {
      return 0;
    }
    const harvesters = room.find(FIND_MY_CREEPS, {
      filter: c => c.memory?.role === "harvester"
    });
    return harvesters.length;
  }

  /**
   * Calculate harvester efficiency based on source coverage.
   * Assumes 1 harvester per source is optimal.
   */
  private calculateHarvesterEfficiency(sourceCount: number, harvesterCount: number): number {
    if (sourceCount === 0) return 1.0;

    // Calculate coverage ratio
    const coverage = harvesterCount / sourceCount;

    // Efficiency caps at 1.0 (full coverage) and has minimum of 0.5 (partial coverage)
    return Math.max(Math.min(coverage, 1.0), this.MIN_HARVESTER_EFFICIENCY);
  }

  /**
   * Calculate total energy production per tick.
   */
  private calculateProduction(sourceCount: number, efficiency: number): number {
    return sourceCount * this.ENERGY_PER_SOURCE_TICK * efficiency;
  }

  /**
   * Estimate current energy consumption per tick from spawning.
   * Uses recent spawn history if available, otherwise estimates from creep count.
   */
  private estimateConsumption(room: Room): number {
    // Check if room.find is available
    if (!room || typeof room.find !== "function") {
      return 0; // Can't calculate consumption without room.find
    }

    // Count spawns actively spawning
    const spawns = room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_SPAWN
    });

    let activeSpawnCost = 0;
    for (const spawn of spawns) {
      if (spawn.spawning) {
        // Calculate cost per tick for spawning creeps
        // Rough estimate: 1 energy per tick while spawning
        const costPerTick = spawn.spawning.needTime > 0 ? 1 : 0;
        activeSpawnCost += costPerTick;
      }
    }

    // If no active spawning, estimate based on average creep cost
    if (activeSpawnCost === 0 && Game.creeps) {
      const roomCreeps = Object.values(Game.creeps).filter(c => c.room?.name === room.name);
      if (roomCreeps.length > 0) {
        // Assume average creep costs 300 energy and lives 1500 ticks
        const averageCreepCost = 300;
        const averageCreepLifetime = 1500;
        activeSpawnCost = (roomCreeps.length * averageCreepCost) / averageCreepLifetime;
      }
    }

    return activeSpawnCost;
  }

  /**
   * Calculate maximum recommended spawn budget per creep.
   * Ensures spawning doesn't deplete energy faster than production.
   */
  private calculateMaxSpawnBudget(production: number, room: Room): number {
    // Count creeps in room
    const creepCount = Game.creeps ? Object.values(Game.creeps).filter(c => c.room?.name === room.name).length : 0;

    // Calculate sustainable budget per creep
    // Use 80% of production to maintain surplus
    const sustainableProduction = production * this.TARGET_SURPLUS_RATIO;

    // Divide by number of creeps, with minimum of 3 for distribution
    const budget = sustainableProduction / Math.max(creepCount, 3);

    // Return budget with minimum of 200 (basic harvester)
    return Math.max(budget, 200);
  }
}
