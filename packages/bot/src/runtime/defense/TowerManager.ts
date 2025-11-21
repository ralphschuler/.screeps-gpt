import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@ralphschuler/screeps-profiler";
import { WallUpgradeManager } from "./WallUpgradeManager";
import { RepairPriority, type RepairTarget } from "@shared/contracts";
import { EventBus, EventTypes } from "@ralphschuler/screeps-events";

/**
 * Threat assessment for hostile creeps
 */
interface ThreatAssessment {
  creep: Creep;
  priority: number;
  distance: number;
  damage: number;
}

/**
 * Tower action type
 */
type TowerAction = "attack" | "heal" | "repair";

/**
 * Configuration options for TowerManager
 */
export interface TowerManagerOptions {
  logger?: Pick<Console, "log" | "warn">;
  repairThreshold?: number;
  criticalRepairThreshold?: number;
  wallUpgradeManager?: WallUpgradeManager;
  minEnergyForRepair?: number;
  eventBus?: EventBus;
}

/**
 * Manages tower automation with threat-based targeting and repair logic.
 * Implements intelligent prioritization for defense, healing, and maintenance.
 */
@profile
export class TowerManager {
  // Constants for repair priority thresholds
  private static readonly HIGH_PRIORITY_THRESHOLD = 0.5; // 50% health for high-priority structures
  private static readonly WALL_REPAIR_THRESHOLD = 0.8; // 80% for walls/ramparts
  private static readonly HEALTH_DIFFERENCE_THRESHOLD = 0.05; // 5% health difference for sorting

  // Constants for distance-based efficiency
  private static readonly FULL_EFFICIENCY_RANGE = 10; // Full repair power within 10 tiles
  private static readonly MAX_EFFICIENCY_RANGE = 30; // Max range for reasonable efficiency
  private static readonly MIN_EFFICIENCY = 0.1; // Minimum efficiency for very far structures
  private static readonly EFFICIENCY_DECAY_FACTOR = 20; // Linear decay factor from 10-30 tiles

  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly repairThreshold: number;
  private readonly criticalRepairThreshold: number;
  private readonly wallUpgradeManager: WallUpgradeManager;
  private readonly minEnergyForRepair: number;
  private readonly eventBus?: EventBus;

  public constructor(options: TowerManagerOptions = {}) {
    this.logger = options.logger ?? console;
    this.repairThreshold = options.repairThreshold ?? 0.8; // Repair structures below 80% health
    this.criticalRepairThreshold = options.criticalRepairThreshold ?? 0.2; // Critical repair below 20%
    this.wallUpgradeManager = options.wallUpgradeManager ?? new WallUpgradeManager();
    this.minEnergyForRepair = options.minEnergyForRepair ?? 500; // Reserve energy for defense
    this.eventBus = options.eventBus;
  }

  /**
   * Execute tower logic for a room
   */
  public run(room: RoomLike): Record<TowerAction, number> {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    const actions: Record<TowerAction, number> = {
      attack: 0,
      heal: 0,
      repair: 0
    };

    if (towers.length === 0) {
      return actions;
    }

    // Get all hostiles in room
    const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];

    // Emit hostile detection event if EventBus is available
    if (this.eventBus && hostiles.length > 0) {
      const hostileUsernames = [...new Set(hostiles.map(h => h.owner.username))];
      this.eventBus.emit(
        EventTypes.HOSTILE_DETECTED,
        {
          roomName: room.name,
          hostileCount: hostiles.length,
          hostileUsernames
        },
        "TowerManager"
      );
    }

    // Get damaged friendlies
    const damagedFriendlies = room.find(FIND_MY_CREEPS, {
      filter: (c: Creep) => c.hits < c.hitsMax
    }) as Creep[];

    // Get structures needing repair
    const targetHits = this.wallUpgradeManager.getTargetHits(room);
    const damagedStructures = room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => {
        if (!("hits" in s) || typeof s.hits !== "number") {
          return false;
        }

        // Apply stage-based caps to walls and ramparts
        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
          return s.hits < targetHits;
        }

        // Other structures: repair to threshold percentage
        const healthPercent = s.hits / s.hitsMax;
        return healthPercent < this.repairThreshold;
      }
    }) as Structure[];

    // Initialize Memory.towerState if needed for tracking energy depletion
    Memory.towerState ??= {};

    // Process each tower
    for (const tower of towers) {
      // Emit energy depletion event if tower energy reaches zero
      if (this.eventBus && tower.store.energy === 0 && !Memory.towerState[tower.id]) {
        Memory.towerState[tower.id] = { depleted: true };
        this.eventBus.emit(
          EventTypes.ENERGY_DEPLETED,
          {
            roomName: room.name,
            structureType: STRUCTURE_TOWER,
            structureId: tower.id
          },
          "TowerManager"
        );
      } else if (tower.store.energy > this.minEnergyForRepair && Memory.towerState[tower.id]?.depleted) {
        // Tower has been refilled with sufficient energy, emit restoration event
        delete Memory.towerState[tower.id];
        if (this.eventBus) {
          this.eventBus.emit(
            EventTypes.ENERGY_RESTORED,
            {
              roomName: room.name,
              structureType: STRUCTURE_TOWER,
              structureId: tower.id,
              energyAmount: tower.store.energy
            },
            "TowerManager"
          );
        }
      }

      // Priority 1: Attack hostiles
      if (hostiles.length > 0) {
        const target = this.selectAttackTarget(tower, hostiles);
        if (target) {
          const result = tower.attack(target);
          if (result === OK) {
            actions.attack++;
            continue;
          }
        }
      }

      // Priority 2: Heal damaged friendlies
      if (damagedFriendlies.length > 0) {
        const target = this.selectHealTarget(tower, damagedFriendlies);
        if (target) {
          const result = tower.heal(target);
          if (result === OK) {
            actions.heal++;
            continue;
          }
        }
      }

      // Priority 3: Repair critical structures
      if (damagedStructures.length > 0) {
        const target = this.selectRepairTarget(tower, damagedStructures);
        if (target) {
          const result = tower.repair(target);
          if (result === OK) {
            actions.repair++;
          }
        }
      }
    }

    return actions;
  }

  /**
   * Select the best hostile target using threat assessment
   */
  private selectAttackTarget(tower: StructureTower, hostiles: Creep[]): Creep | null {
    if (hostiles.length === 0) {
      return null;
    }

    // Assess threats for all hostiles
    const threats = hostiles.map(hostile => this.assessThreat(tower, hostile));

    // Sort by priority (higher = more dangerous)
    threats.sort((a, b) => b.priority - a.priority);

    return threats[0]?.creep ?? null;
  }

  /**
   * Assess threat level of a hostile creep
   */
  private assessThreat(tower: StructureTower, hostile: Creep): ThreatAssessment {
    let priority = 0;
    const distance = tower.pos.getRangeTo(hostile.pos);

    // Count damage-dealing parts
    const attackParts = hostile.body.filter(
      part => part.type === ATTACK || part.type === RANGED_ATTACK || part.type === WORK
    ).length;

    const healParts = hostile.body.filter(part => part.type === HEAL).length;

    // Base priority on offensive capability
    priority += attackParts * 100;

    // Healers are high priority (can sustain other hostiles)
    priority += healParts * 150;

    // Closer enemies are more dangerous
    priority += Math.max(0, 50 - distance * 2);

    // Wounded enemies are easier to kill (boost priority slightly)
    const healthPercent = hostile.hits / hostile.hitsMax;
    if (healthPercent < 0.5) {
      priority += 50;
    }

    return {
      creep: hostile,
      priority,
      distance,
      damage: attackParts
    };
  }

  /**
   * Select the best friendly creep to heal
   */
  private selectHealTarget(tower: StructureTower, friendlies: Creep[]): Creep | null {
    if (friendlies.length === 0) {
      return null;
    }

    // Sort by health percentage (most wounded first)
    const sorted = friendlies.sort((a, b) => {
      const healthA = a.hits / a.hitsMax;
      const healthB = b.hits / b.hitsMax;
      return healthA - healthB;
    });

    return sorted[0];
  }

  /**
   * Select the best structure to repair using priority-based targeting
   */
  private selectRepairTarget(tower: StructureTower, structures: Structure[]): Structure | null {
    if (structures.length === 0) {
      return null;
    }

    // Check if tower has enough energy for repairs (reserve for defense)
    if (tower.store.getUsedCapacity(RESOURCE_ENERGY) < this.minEnergyForRepair) {
      return null;
    }

    // Build repair targets with priority and efficiency
    const targets: RepairTarget[] = structures.map(structure => {
      const distance = tower.pos.getRangeTo(structure.pos);
      const healthPercent = structure.hits / structure.hitsMax;

      return {
        structure,
        priority: this.calculateRepairPriority(structure, healthPercent),
        healthPercent,
        distance,
        efficiency: this.calculateRepairEfficiency(distance)
      };
    });

    // Filter to only viable targets (efficiency > 0)
    const viableTargets = targets.filter(t => t.efficiency > 0);

    if (viableTargets.length === 0) {
      return null;
    }

    // Sort by priority (descending), then by health percent (ascending), then by efficiency (descending)
    viableTargets.sort((a, b) => {
      // Primary: Priority (higher first)
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      // Secondary: Health percent (lower first)
      if (Math.abs(a.healthPercent - b.healthPercent) > TowerManager.HEALTH_DIFFERENCE_THRESHOLD) {
        return a.healthPercent - b.healthPercent;
      }
      // Tertiary: Efficiency (higher first for same priority and similar health)
      return b.efficiency - a.efficiency;
    });

    return viableTargets[0].structure;
  }

  /**
   * Calculate repair priority tier for a structure
   */
  private calculateRepairPriority(structure: Structure, healthPercent: number): RepairPriority {
    // Critical: <20% health - prevent destruction
    if (healthPercent < this.criticalRepairThreshold) {
      return RepairPriority.CRITICAL;
    }

    // High: Spawn, extensions, storage, containers <50%
    if (
      healthPercent < TowerManager.HIGH_PRIORITY_THRESHOLD &&
      (structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_EXTENSION ||
        structure.structureType === STRUCTURE_STORAGE ||
        structure.structureType === STRUCTURE_CONTAINER)
    ) {
      return RepairPriority.HIGH;
    }

    // Medium: Roads <50%, walls/ramparts <80%
    if (
      (structure.structureType === STRUCTURE_ROAD && healthPercent < TowerManager.HIGH_PRIORITY_THRESHOLD) ||
      (structure.structureType === STRUCTURE_WALL && healthPercent < TowerManager.WALL_REPAIR_THRESHOLD) ||
      (structure.structureType === STRUCTURE_RAMPART && healthPercent < TowerManager.WALL_REPAIR_THRESHOLD)
    ) {
      return RepairPriority.MEDIUM;
    }

    // Low: Everything else needing maintenance
    return RepairPriority.LOW;
  }

  /**
   * Calculate repair efficiency based on distance
   * Towers have full repair power (800) within 10 tiles, decreasing to 200 at 30+ tiles
   */
  private calculateRepairEfficiency(distance: number): number {
    // Full efficiency within FULL_EFFICIENCY_RANGE tiles
    if (distance <= TowerManager.FULL_EFFICIENCY_RANGE) {
      return 1.0;
    }

    // Decreasing efficiency between FULL_EFFICIENCY_RANGE and MAX_EFFICIENCY_RANGE
    if (distance <= TowerManager.MAX_EFFICIENCY_RANGE) {
      const distanceBeyondFull = distance - TowerManager.FULL_EFFICIENCY_RANGE;
      return 1.0 - (distanceBeyondFull / TowerManager.EFFICIENCY_DECAY_FACTOR) * 0.75; // Linear decrease from 1.0 to 0.25
    }

    // Very low efficiency beyond MAX_EFFICIENCY_RANGE - deprioritize
    return TowerManager.MIN_EFFICIENCY;
  }

  /**
   * Get threat summary for a room (useful for monitoring)
   */
  public getThreatSummary(room: RoomLike): {
    hostileCount: number;
    totalThreat: number;
    highestThreat: ThreatAssessment | null;
  } {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: (s: Structure) => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    const hostiles = room.find(FIND_HOSTILE_CREEPS) as Creep[];

    if (hostiles.length === 0 || towers.length === 0) {
      return {
        hostileCount: 0,
        totalThreat: 0,
        highestThreat: null
      };
    }

    const threats = hostiles.map(hostile => this.assessThreat(towers[0], hostile));
    const totalThreat = threats.reduce((sum, t) => sum + t.priority, 0);
    const highestThreat = threats.sort((a, b) => b.priority - a.priority)[0] ?? null;

    return {
      hostileCount: hostiles.length,
      totalThreat,
      highestThreat
    };
  }
}
