/**
 * Military Roles - Phase 7.3 & 7.4
 *
 * Defense and offensive roles:
 * - GuardAnt (melee/ranged defenders)
 * - HealerAnt
 * - SoldierAnt (melee/range offense)
 * - SiegeUnit (dismantler/tough)
 * - Harasser (early aggression)
 * - Ranger (ranged combat)
 */

import type { SwarmCreepMemory, SquadMemory } from "../../memory/schemas";

/**
 * Get creep memory with type safety
 */
function getMemory(creep: Creep): SwarmCreepMemory {
  return creep.memory as unknown as SwarmCreepMemory;
}

/**
 * Get squad memory
 */
function getSquadMemory(squadId: string): SquadMemory | undefined {
  const mem = Memory as unknown as Record<string, Record<string, SquadMemory>>;
  return mem["squads"]?.[squadId];
}

/**
 * Find hostile target with priority
 * Priority: Healers > Ranged > Melee > Claimers > Workers
 */
function findPriorityTarget(creep: Creep): Creep | null {
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) return null;

  // Score hostiles by threat
  const scored = hostiles.map(hostile => {
    let score = 0;

    for (const part of hostile.body) {
      if (!part.hits) continue;

      switch (part.type) {
        case HEAL:
          score += 100;
          break;
        case RANGED_ATTACK:
          score += 50;
          break;
        case ATTACK:
          score += 40;
          break;
        case CLAIM:
          score += 60;
          break;
        case WORK:
          score += 30;
          break;
      }

      // Boosted parts are higher priority
      if (part.boost) {
        score += 20;
      }
    }

    return { hostile, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored[0]?.hostile ?? null;
}

/**
 * Find damaged ally (reserved for future use in healer logic)
 */
function findDamagedAlly(creep: Creep): Creep | null {
  return creep.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: c => c.hits < c.hitsMax
  });
}

// Export for future use
void findDamagedAlly;

/**
 * Move to rally point
 */
function moveToRally(creep: Creep, rallyRoom: string): void {
  if (creep.room.name !== rallyRoom) {
    const exit = creep.room.findExitTo(rallyRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos);
      }
    }
  } else {
    // Move to center of room
    creep.moveTo(25, 25, { visualizePathStyle: { stroke: "#ff0000" } });
  }
}

// =============================================================================
// GuardAnt - Home defense (melee/ranged)
// =============================================================================

/**
 * Run GuardAnt behavior
 */
export function runGuardAnt(creep: Creep): void {
  // Find hostile target
  const target = findPriorityTarget(creep);

  if (target) {
    // Attack if in range
    const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMelee = creep.getActiveBodyparts(ATTACK) > 0;

    if (hasRanged) {
      if (creep.pos.getRangeTo(target) <= 3) {
        creep.rangedAttack(target);
      }
    }

    if (hasMelee) {
      if (creep.pos.getRangeTo(target) <= 1) {
        creep.attack(target);
      }
    }

    // Move towards target
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ff0000" } });
  } else {
    // No hostiles, patrol near spawn
    const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn && creep.pos.getRangeTo(spawn) > 5) {
      creep.moveTo(spawn, { visualizePathStyle: { stroke: "#00ff00" } });
    }
  }
}

// =============================================================================
// HealerAnt
// =============================================================================

/**
 * Run HealerAnt behavior
 */
export function runHealerAnt(creep: Creep): void {
  // Priority 1: Heal self if critically damaged
  if (creep.hits < creep.hitsMax * 0.5) {
    creep.heal(creep);
    return;
  }

  // Priority 2: Heal nearby damaged allies
  const damagedNearby = creep.pos.findInRange(FIND_MY_CREEPS, 3, {
    filter: c => c.hits < c.hitsMax
  });

  if (damagedNearby.length > 0) {
    // Sort by damage
    damagedNearby.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
    const target = damagedNearby[0]!;

    if (creep.pos.getRangeTo(target) <= 1) {
      creep.heal(target);
    } else {
      creep.rangedHeal(target);
      creep.moveTo(target, { visualizePathStyle: { stroke: "#00ff00" } });
    }
    return;
  }

  // Priority 3: Follow military creeps
  const military = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: c => {
      const m = c.memory as unknown as SwarmCreepMemory;
      return m.family === "military" && m.role !== "healer";
    }
  });

  if (military) {
    creep.moveTo(military, { visualizePathStyle: { stroke: "#00ff00" } });
  }
}

// =============================================================================
// SoldierAnt - Offensive melee/range
// =============================================================================

/**
 * Run SoldierAnt behavior
 */
export function runSoldierAnt(creep: Creep): void {
  const memory = getMemory(creep);

  // Check if in a squad
  if (memory.squadId) {
    const squad = getSquadMemory(memory.squadId);
    if (squad) {
      runSquadBehavior(creep, squad);
      return;
    }
  }

  // Solo behavior
  const targetRoom = memory.targetRoom ?? memory.homeRoom;

  // Move to target room if not there
  if (creep.room.name !== targetRoom) {
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos);
      }
    }
    return;
  }

  // In target room - find and attack
  const target = findPriorityTarget(creep);

  if (target) {
    const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMelee = creep.getActiveBodyparts(ATTACK) > 0;

    if (hasRanged && creep.pos.getRangeTo(target) <= 3) {
      creep.rangedAttack(target);
    }

    if (hasMelee && creep.pos.getRangeTo(target) <= 1) {
      creep.attack(target);
    }

    creep.moveTo(target, { visualizePathStyle: { stroke: "#ff0000" } });
  } else {
    // Attack structures
    const hostileStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType !== STRUCTURE_CONTROLLER
    });

    if (hostileStructure) {
      if (creep.attack(hostileStructure) === ERR_NOT_IN_RANGE) {
        creep.moveTo(hostileStructure, { visualizePathStyle: { stroke: "#ff0000" } });
      }
    }
  }
}

// =============================================================================
// SiegeUnit - Dismantler/tough
// =============================================================================

/**
 * Run SiegeUnit behavior
 */
export function runSiegeUnit(creep: Creep): void {
  const memory = getMemory(creep);

  // Check if in a squad
  if (memory.squadId) {
    const squad = getSquadMemory(memory.squadId);
    if (squad) {
      runSquadBehavior(creep, squad);
      return;
    }
  }

  const targetRoom = memory.targetRoom ?? memory.homeRoom;

  // Move to target room if not there
  if (creep.room.name !== targetRoom) {
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos);
      }
    }
    return;
  }

  // Priority 1: Dismantle spawns
  const spawn = creep.pos.findClosestByRange(FIND_HOSTILE_SPAWNS);
  if (spawn) {
    if (creep.dismantle(spawn) === ERR_NOT_IN_RANGE) {
      creep.moveTo(spawn, { visualizePathStyle: { stroke: "#ff0000" } });
    }
    return;
  }

  // Priority 2: Dismantle towers
  const tower = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_TOWER
  });
  if (tower) {
    if (creep.dismantle(tower) === ERR_NOT_IN_RANGE) {
      creep.moveTo(tower, { visualizePathStyle: { stroke: "#ff0000" } });
    }
    return;
  }

  // Priority 3: Dismantle walls/ramparts blocking path
  const wall = creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: s =>
      (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) &&
      s.hits < 100000
  });
  if (wall) {
    if (creep.dismantle(wall) === ERR_NOT_IN_RANGE) {
      creep.moveTo(wall, { visualizePathStyle: { stroke: "#ff0000" } });
    }
    return;
  }

  // Priority 4: Any hostile structure
  const structure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType !== STRUCTURE_CONTROLLER
  });
  if (structure) {
    if (creep.dismantle(structure) === ERR_NOT_IN_RANGE) {
      creep.moveTo(structure, { visualizePathStyle: { stroke: "#ff0000" } });
    }
  }
}

// =============================================================================
// Harasser - Early aggression
// =============================================================================

/**
 * Run Harasser behavior
 */
export function runHarasser(creep: Creep): void {
  const memory = getMemory(creep);
  const targetRoom = memory.targetRoom;

  if (!targetRoom) {
    // Wait near spawn
    const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn) {
      creep.moveTo(spawn);
    }
    return;
  }

  // Move to target room
  if (creep.room.name !== targetRoom) {
    const exit = creep.room.findExitTo(targetRoom);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos);
      }
    }
    return;
  }

  // Hit and run tactics - attack workers and flee from military
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

  // Check if there are dangerous hostiles nearby
  const dangerous = hostiles.filter(h => {
    const hasAttack = h.body.some(p => p.type === ATTACK || p.type === RANGED_ATTACK);
    return hasAttack && creep.pos.getRangeTo(h) < 5;
  });

  if (dangerous.length > 0) {
    // Flee
    const flee = PathFinder.search(
      creep.pos,
      dangerous.map(d => ({ pos: d.pos, range: 10 })),
      { flee: true }
    );
    if (flee.path.length > 0) {
      creep.moveByPath(flee.path);
    }
    return;
  }

  // Target workers
  const workers = hostiles.filter(h => {
    return h.body.some(p => p.type === WORK || p.type === CARRY);
  });

  if (workers.length > 0) {
    const target = workers.reduce((a, b) => (creep.pos.getRangeTo(a) < creep.pos.getRangeTo(b) ? a : b));

    if (creep.pos.getRangeTo(target) <= 3) {
      creep.rangedAttack(target);
    }
    if (creep.pos.getRangeTo(target) <= 1) {
      creep.attack(target);
    }
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ff0000" } });
  }
}

// =============================================================================
// Ranger - Ranged combat
// =============================================================================

/**
 * Run Ranger behavior
 */
export function runRanger(creep: Creep): void {
  const memory = getMemory(creep);

  // Check if in a squad
  if (memory.squadId) {
    const squad = getSquadMemory(memory.squadId);
    if (squad) {
      runSquadBehavior(creep, squad);
      return;
    }
  }

  // Find target
  const target = findPriorityTarget(creep);

  if (target) {
    const range = creep.pos.getRangeTo(target);

    // Kiting behavior - maintain distance of 3
    if (range < 3) {
      // Move away
      const flee = PathFinder.search(creep.pos, [{ pos: target.pos, range: 5 }], { flee: true });
      if (flee.path.length > 0) {
        creep.moveByPath(flee.path);
      }
    } else if (range > 3) {
      // Move closer
      creep.moveTo(target, { visualizePathStyle: { stroke: "#ff0000" } });
    }

    // Attack
    if (range <= 3) {
      creep.rangedAttack(target);
    }
  } else {
    // No targets, patrol or return home
    const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
    if (spawn && creep.pos.getRangeTo(spawn) > 10) {
      creep.moveTo(spawn);
    }
  }
}

// =============================================================================
// Squad coordination
// =============================================================================

/**
 * Run squad behavior
 */
function runSquadBehavior(creep: Creep, squad: SquadMemory): void {
  const memory = getMemory(creep);

  switch (squad.state) {
    case "gathering":
      // Move to rally point
      moveToRally(creep, squad.rallyRoom);

      // Check if all members are gathered
      const members = squad.members
        .map(name => Game.creeps[name])
        .filter((c): c is Creep => c !== undefined);

      const allGathered = members.every(m => m.room.name === squad.rallyRoom);
      if (allGathered && members.length >= 2) {
        // Transition to moving
        squad.state = "moving";
      }
      break;

    case "moving":
      // Move to target room
      const targetRoom = squad.targetRooms[0];
      if (targetRoom && creep.room.name !== targetRoom) {
        const exit = creep.room.findExitTo(targetRoom);
        if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
          const exitPos = creep.pos.findClosestByRange(exit);
          if (exitPos) {
            creep.moveTo(exitPos);
          }
        }
      } else if (targetRoom && creep.room.name === targetRoom) {
        // Transition to attacking
        squad.state = "attacking";
      }
      break;

    case "attacking":
      // Execute role-specific attack
      const roleMemory = getMemory(creep);
      if (roleMemory.role === "soldier" || roleMemory.role === "guard") {
        runSoldierAnt(creep);
      } else if (roleMemory.role === "healer") {
        runHealerAnt(creep);
      } else if (roleMemory.role === "siegeUnit") {
        runSiegeUnit(creep);
      } else if (roleMemory.role === "ranger") {
        runRanger(creep);
      }

      // Check retreat condition
      if (creep.hits < creep.hitsMax * squad.retreatThreshold) {
        squad.state = "retreating";
      }
      break;

    case "retreating":
      // Return to rally room
      moveToRally(creep, squad.rallyRoom);

      // Check if safe
      if (creep.hits === creep.hitsMax && creep.room.name === squad.rallyRoom) {
        squad.state = "gathering";
      }
      break;

    case "dissolving":
      // Return home
      const homeRoom = memory.homeRoom;
      if (creep.room.name !== homeRoom) {
        const exit = creep.room.findExitTo(homeRoom);
        if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
          const exitPos = creep.pos.findClosestByRange(exit);
          if (exitPos) {
            creep.moveTo(exitPos);
          }
        }
      }
      // Clear squad assignment
      delete memory.squadId;
      break;
  }
}

// =============================================================================
// Role dispatcher
// =============================================================================

/**
 * Run military role
 */
export function runMilitaryRole(creep: Creep): void {
  const memory = getMemory(creep);

  switch (memory.role) {
    case "guard":
      runGuardAnt(creep);
      break;
    case "healer":
      runHealerAnt(creep);
      break;
    case "soldier":
      runSoldierAnt(creep);
      break;
    case "siegeUnit":
      runSiegeUnit(creep);
      break;
    case "harasser":
      runHarasser(creep);
      break;
    case "ranger":
      runRanger(creep);
      break;
    default:
      runGuardAnt(creep);
  }
}
