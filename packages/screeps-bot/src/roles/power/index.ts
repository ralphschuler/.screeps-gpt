/**
 * Power Roles - Phase 7.6 & 12
 *
 * Power creep roles:
 * - PowerQueen (economy-focused Operator)
 * - PowerWarrior (combat-support)
 */

import type { SwarmCreepMemory } from "../../memory/schemas";
// import { getConfig } from "../../config";

/**
 * Get power creep memory
 */
function getPowerCreepMemory(creep: PowerCreep): SwarmCreepMemory {
  return creep.memory as unknown as SwarmCreepMemory;
}

/**
 * Power ability cooldowns (to avoid wasting ops)
 */
const ABILITY_COOLDOWNS: Partial<Record<PowerConstant, number>> = {
  [PWR_GENERATE_OPS]: 50,
  [PWR_OPERATE_SPAWN]: 1000,
  [PWR_OPERATE_EXTENSION]: 50,
  [PWR_OPERATE_STORAGE]: 500,
  [PWR_OPERATE_LAB]: 50,
  [PWR_OPERATE_FACTORY]: 1000,
  [PWR_OPERATE_TOWER]: 10,
  [PWR_REGEN_SOURCE]: 300,
  [PWR_REGEN_MINERAL]: 100,
  [PWR_SHIELD]: 50,
  [PWR_DISRUPT_SPAWN]: 5,
  [PWR_DISRUPT_TOWER]: 5,
  [PWR_DISRUPT_SOURCE]: 100,
  [PWR_FORTIFY]: 5
};

// Export for future use in ability scheduling
void ABILITY_COOLDOWNS;

/**
 * Check if power creep has enough ops
 */
function hasOps(creep: PowerCreep, amount: number): boolean {
  return creep.store.getUsedCapacity(RESOURCE_OPS) >= amount;
}

/**
 * Use GENERATE_OPS if needed and available
 */
function generateOpsIfNeeded(creep: PowerCreep): boolean {
  if (creep.store.getUsedCapacity(RESOURCE_OPS) < 50) {
    const power = creep.powers[PWR_GENERATE_OPS];
    if (power && power.cooldown === 0) {
      creep.usePower(PWR_GENERATE_OPS);
      return true;
    }
  }
  return false;
}

// =============================================================================
// PowerQueen - Economy-focused Operator
// =============================================================================

/**
 * Run PowerQueen behavior
 * Focus on economy powers: OPERATE_SPAWN, OPERATE_EXTENSION, OPERATE_STORAGE, OPERATE_LAB, OPERATE_FACTORY
 */
export function runPowerQueen(creep: PowerCreep): void {
  const memory = getPowerCreepMemory(creep);

  // Generate ops if low
  if (generateOpsIfNeeded(creep)) return;

  // Get home room or current room
  const homeRoom = memory.homeRoom ? Game.rooms[memory.homeRoom] : creep.room;
  if (!homeRoom || !creep.room) return;

  // Move to home room if not there
  if (creep.room.name !== homeRoom.name) {
    const exit = creep.room.findExitTo(homeRoom.name);
    if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
      const exitPos = creep.pos.findClosestByRange(exit);
      if (exitPos) {
        creep.moveTo(exitPos);
      }
    }
    return;
  }

  // Priority 1: OPERATE_SPAWN (if spawn is spawning)
  const spawns = homeRoom.find(FIND_MY_SPAWNS);
  for (const spawn of spawns) {
    if (spawn.spawning && hasOps(creep, 100)) {
      const power = creep.powers[PWR_OPERATE_SPAWN];
      if (power && power.cooldown === 0) {
        // Check if already affected
        const effects = spawn.effects ?? [];
        const hasEffect = effects.some(e => e.effect === PWR_OPERATE_SPAWN);
        if (!hasEffect) {
          if (creep.pos.getRangeTo(spawn) <= 3) {
            creep.usePower(PWR_OPERATE_SPAWN, spawn);
          } else {
            creep.moveTo(spawn);
          }
          return;
        }
      }
    }
  }

  // Priority 2: OPERATE_EXTENSION (if extensions need filling)
  const extensions = homeRoom.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_EXTENSION
  }) as StructureExtension[];

  const emptyExtensions = extensions.filter(e => e.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
  if (emptyExtensions.length > 10 && homeRoom.storage && hasOps(creep, 2)) {
    const power = creep.powers[PWR_OPERATE_EXTENSION];
    if (power && power.cooldown === 0) {
      if (creep.pos.getRangeTo(homeRoom.storage) <= 3) {
        creep.usePower(PWR_OPERATE_EXTENSION, homeRoom.storage);
      } else {
        creep.moveTo(homeRoom.storage);
      }
      return;
    }
  }

  // Priority 3: OPERATE_STORAGE (if storage exists)
  if (homeRoom.storage && hasOps(creep, 100)) {
    const power = creep.powers[PWR_OPERATE_STORAGE];
    if (power && power.cooldown === 0) {
      const effects = homeRoom.storage.effects ?? [];
      const hasEffect = effects.some(e => e.effect === PWR_OPERATE_STORAGE);
      if (!hasEffect) {
        if (creep.pos.getRangeTo(homeRoom.storage) <= 3) {
          creep.usePower(PWR_OPERATE_STORAGE, homeRoom.storage);
        } else {
          creep.moveTo(homeRoom.storage);
        }
        return;
      }
    }
  }

  // Priority 4: OPERATE_LAB (if labs running reactions)
  const labs = homeRoom.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LAB
  }) as StructureLab[];

  for (const lab of labs) {
    if (lab.cooldown > 0 && hasOps(creep, 10)) {
      const power = creep.powers[PWR_OPERATE_LAB];
      if (power && power.cooldown === 0) {
        const effects = lab.effects ?? [];
        const hasEffect = effects.some(e => e.effect === PWR_OPERATE_LAB);
        if (!hasEffect) {
          if (creep.pos.getRangeTo(lab) <= 3) {
            creep.usePower(PWR_OPERATE_LAB, lab);
          } else {
            creep.moveTo(lab);
          }
          return;
        }
      }
    }
  }

  // Priority 5: OPERATE_FACTORY (if factory has work)
  const factory = homeRoom.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_FACTORY
  })[0] as StructureFactory | undefined;

  if (factory && factory.cooldown > 0 && hasOps(creep, 100)) {
    const power = creep.powers[PWR_OPERATE_FACTORY];
    if (power && power.cooldown === 0) {
      const effects = factory.effects ?? [];
      const hasEffect = effects.some(e => e.effect === PWR_OPERATE_FACTORY);
      if (!hasEffect) {
        if (creep.pos.getRangeTo(factory) <= 3) {
          creep.usePower(PWR_OPERATE_FACTORY, factory);
        } else {
          creep.moveTo(factory);
        }
        return;
      }
    }
  }

  // Priority 6: REGEN_SOURCE (keep sources full)
  const sources = homeRoom.find(FIND_SOURCES);
  for (const source of sources) {
    if (source.energy < source.energyCapacity * 0.5 && hasOps(creep, 10)) {
      const power = creep.powers[PWR_REGEN_SOURCE];
      if (power && power.cooldown === 0) {
        const effects = source.effects ?? [];
        const hasEffect = effects.some(e => e.effect === PWR_REGEN_SOURCE);
        if (!hasEffect) {
          if (creep.pos.getRangeTo(source) <= 3) {
            creep.usePower(PWR_REGEN_SOURCE, source);
          } else {
            creep.moveTo(source);
          }
          return;
        }
      }
    }
  }

  // Idle - stay near storage
  if (homeRoom.storage && creep.pos.getRangeTo(homeRoom.storage) > 3) {
    creep.moveTo(homeRoom.storage);
  }
}

// =============================================================================
// PowerWarrior - Combat-support power creep
// =============================================================================

/**
 * Run PowerWarrior behavior
 * Focus on combat powers: OPERATE_TOWER, SHIELD, DISRUPT_SPAWN, DISRUPT_TOWER, FORTIFY
 */
export function runPowerWarrior(creep: PowerCreep): void {
  const memory = getPowerCreepMemory(creep);

  // Generate ops if low
  if (generateOpsIfNeeded(creep)) return;

  // Check for hostiles in room
  if (!creep.room) return;
  
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
  const inCombat = hostiles.length > 0;

  if (inCombat) {
    // Priority 1: SHIELD (self protection if low HP)
    if (creep.hits < creep.hitsMax * 0.7 && hasOps(creep, 10)) {
      const power = creep.powers[PWR_SHIELD];
      if (power && power.cooldown === 0) {
        creep.usePower(PWR_SHIELD);
        return;
      }
    }

    // Priority 2: OPERATE_TOWER (boost our towers)
    const towers = creep.room.find(FIND_MY_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    for (const tower of towers) {
      if (hasOps(creep, 10)) {
        const power = creep.powers[PWR_OPERATE_TOWER];
        if (power && power.cooldown === 0) {
          const effects = tower.effects ?? [];
          const hasEffect = effects.some(e => e.effect === PWR_OPERATE_TOWER);
          if (!hasEffect) {
            if (creep.pos.getRangeTo(tower) <= 3) {
              creep.usePower(PWR_OPERATE_TOWER, tower);
            } else {
              creep.moveTo(tower);
            }
            return;
          }
        }
      }
    }

    // Priority 3: DISRUPT_SPAWN (enemy spawns)
    const enemySpawns = creep.room.find(FIND_HOSTILE_SPAWNS);
    for (const spawn of enemySpawns) {
      if (hasOps(creep, 10)) {
        const power = creep.powers[PWR_DISRUPT_SPAWN];
        if (power && power.cooldown === 0) {
          if (creep.pos.getRangeTo(spawn) <= 20) {
            creep.usePower(PWR_DISRUPT_SPAWN, spawn);
          } else {
            creep.moveTo(spawn);
          }
          return;
        }
      }
    }

    // Priority 4: DISRUPT_TOWER (enemy towers)
    const enemyTowers = creep.room.find(FIND_HOSTILE_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_TOWER
    }) as StructureTower[];

    for (const tower of enemyTowers) {
      if (hasOps(creep, 10)) {
        const power = creep.powers[PWR_DISRUPT_TOWER];
        if (power && power.cooldown === 0) {
          if (creep.pos.getRangeTo(tower) <= 50) {
            creep.usePower(PWR_DISRUPT_TOWER, tower);
          } else {
            creep.moveTo(tower);
          }
          return;
        }
      }
    }

    // Priority 5: FORTIFY (strengthen our ramparts)
    if (creep.room) {
      const ramparts = creep.room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_RAMPART
      }) as StructureRampart[];

      const weakRampart = ramparts.find(r => r.hits < 100000);
      if (weakRampart && hasOps(creep, 5)) {
        const power = creep.powers[PWR_FORTIFY];
        if (power && power.cooldown === 0) {
          if (creep.pos.getRangeTo(weakRampart) <= 3) {
            creep.usePower(PWR_FORTIFY, weakRampart);
          } else {
            creep.moveTo(weakRampart);
          }
          return;
        }
      }
    }

    // Stay near combat but not too close
    const nearestHostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
    if (nearestHostile) {
      const range = creep.pos.getRangeTo(nearestHostile);
      if (range < 5) {
        // Retreat
        const flee = PathFinder.search(creep.pos, [{ pos: nearestHostile.pos, range: 8 }], { flee: true });
        if (flee.path.length > 0) {
          creep.moveByPath(flee.path);
        }
      } else if (range > 10) {
        creep.moveTo(nearestHostile);
      }
    }
  } else {
    // No combat - move to target room or stay home
    const targetRoom = memory.targetRoom;
    if (targetRoom && creep.room && creep.room.name !== targetRoom) {
      const exit = creep.room.findExitTo(targetRoom);
      if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
        const exitPos = creep.pos.findClosestByRange(exit);
        if (exitPos) {
          creep.moveTo(exitPos);
        }
      }
    } else {
      // Stay near spawn
      const spawn = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
      if (spawn && creep.pos.getRangeTo(spawn) > 5) {
        creep.moveTo(spawn);
      }
    }
  }
}

// =============================================================================
// Power Harvester (for Power Banks)
// =============================================================================

/**
 * Run PowerHarvester behavior
 * Harvests power from Power Banks
 */
export function runPowerHarvester(creep: Creep): void {
  const memory = creep.memory as unknown as SwarmCreepMemory;

  // Check if we have a target power bank
  if (memory.targetId) {
    const powerBank = Game.getObjectById(memory.targetId as unknown as Id<StructurePowerBank>);

    if (!powerBank) {
      // Power bank destroyed - collect dropped power
      const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_POWER
      })[0];

      if (dropped) {
        if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
          creep.moveTo(dropped);
        }
      } else {
        // Return home
        delete memory.targetId;
      }
      return;
    }

    // Attack power bank
    if (creep.attack(powerBank) === ERR_NOT_IN_RANGE) {
      creep.moveTo(powerBank, { visualizePathStyle: { stroke: "#ff00ff" } });
    }
  } else {
    // Wait or look for power bank
    const powerBank = creep.room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_POWER_BANK
    })[0] as StructurePowerBank | undefined;

    if (powerBank) {
      memory.targetId = powerBank.id as unknown as Id<_HasId>;
    } else {
      // Move to target room if set
      const targetRoom = memory.targetRoom;
      if (targetRoom && creep.room.name !== targetRoom) {
        const exit = creep.room.findExitTo(targetRoom);
        if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
          const exitPos = creep.pos.findClosestByRange(exit);
          if (exitPos) {
            creep.moveTo(exitPos);
          }
        }
      }
    }
  }
}

/**
 * Run PowerCarrier behavior
 * Carries power from Power Banks back to storage
 */
export function runPowerCarrier(creep: Creep): void {
  const memory = creep.memory as unknown as SwarmCreepMemory;

  if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
    // Deliver to storage/terminal
    const homeRoom = Game.rooms[memory.homeRoom];
    if (!homeRoom) return;

    if (creep.room.name !== memory.homeRoom) {
      const exit = creep.room.findExitTo(memory.homeRoom);
      if (exit !== ERR_NO_PATH && exit !== ERR_INVALID_ARGS) {
        const exitPos = creep.pos.findClosestByRange(exit);
        if (exitPos) {
          creep.moveTo(exitPos);
        }
      }
      return;
    }

    const target = homeRoom.terminal ?? homeRoom.storage;
    if (target) {
      if (creep.transfer(target, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
    }
  } else {
    // Go to power bank location
    const targetRoom = memory.targetRoom;
    if (targetRoom) {
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

      // Pick up dropped power
      const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
        filter: r => r.resourceType === RESOURCE_POWER
      })[0];

      if (dropped) {
        if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
          creep.moveTo(dropped);
        }
      } else {
        // Wait near power bank location
        const powerBank = creep.room.find(FIND_STRUCTURES, {
          filter: s => s.structureType === STRUCTURE_POWER_BANK
        })[0];

        if (powerBank) {
          if (creep.pos.getRangeTo(powerBank) > 3) {
            creep.moveTo(powerBank);
          }
        }
      }
    }
  }
}

// =============================================================================
// Role dispatcher
// =============================================================================

/**
 * Run power creep role
 */
export function runPowerRole(creep: PowerCreep): void {
  const memory = getPowerCreepMemory(creep);

  switch (memory.role) {
    case "powerQueen":
      runPowerQueen(creep);
      break;
    case "powerWarrior":
      runPowerWarrior(creep);
      break;
    default:
      runPowerQueen(creep);
  }
}

/**
 * Run power-related creep roles (for regular creeps)
 */
export function runPowerCreepRole(creep: Creep): void {
  const memory = creep.memory as unknown as SwarmCreepMemory;

  switch (memory.role) {
    // Power harvesters are regular creeps
    default:
      runPowerHarvester(creep);
  }
}
