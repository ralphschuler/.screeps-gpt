import type { RoomLike } from "@runtime/types/GameContext";
import { profile } from "@profiler";

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
 * Manages tower automation with threat-based targeting and repair logic.
 * Implements intelligent prioritization for defense, healing, and maintenance.
 */
@profile
export class TowerManager {
  private readonly logger: Pick<Console, "log" | "warn">;
  private readonly repairThreshold: number;
  private readonly criticalRepairThreshold: number;

  public constructor(
    logger: Pick<Console, "log" | "warn"> = console,
    repairThreshold: number = 0.8, // Repair structures below 80% health
    criticalRepairThreshold: number = 0.3 // Critical repair below 30%
  ) {
    this.logger = logger;
    this.repairThreshold = repairThreshold;
    this.criticalRepairThreshold = criticalRepairThreshold;
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

    // Get damaged friendlies
    const damagedFriendlies = room.find(FIND_MY_CREEPS, {
      filter: (c: Creep) => c.hits < c.hitsMax
    }) as Creep[];

    // Get structures needing repair
    const damagedStructures = room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => {
        if (!("hits" in s) || typeof s.hits !== "number") {
          return false;
        }

        // Skip walls and ramparts for now (separate logic needed)
        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
          return false;
        }

        const healthPercent = s.hits / s.hitsMax;
        return healthPercent < this.repairThreshold;
      }
    }) as Structure[];

    // Process each tower
    for (const tower of towers) {
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

    return threats[0]?.creep || null;
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
   * Select the best structure to repair
   */
  private selectRepairTarget(tower: StructureTower, structures: Structure[]): Structure | null {
    if (structures.length === 0) {
      return null;
    }

    // Prioritize critical structures
    const critical = structures.filter(s => {
      const healthPercent = s.hits / s.hitsMax;
      return healthPercent < this.criticalRepairThreshold;
    });

    if (critical.length > 0) {
      // Repair most damaged critical structure
      return critical.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax)[0];
    }

    // Otherwise repair closest damaged structure
    return tower.pos.findClosestByRange(structures) || structures[0];
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
    const highestThreat = threats.sort((a, b) => b.priority - a.priority)[0] || null;

    return {
      hostileCount: hostiles.length,
      totalThreat,
      highestThreat
    };
  }
}
