import type { SwarmRole } from "../types.js";
import { pickEnergyTarget, transferEnergy, withdrawEnergy } from "./logistics.js";
import { selectExitTowards } from "./navigation.js";

export const SWARM_ROLES = [
  "larvaWorker",
  "harvester",
  "hauler",
  "upgrader",
  "foragerAnt",
  "builderAnt",
  "queenCarrier",
  "mineralHarvester",
  "depositHarvester",
  "terminalManager",
  "scoutAnt",
  "claimAnt",
  "guardAnt",
  "healerAnt",
  "soldierAnt",
  "engineer",
  "remoteWorker",
  "siegeUnit",
  "linkManager",
  "factoryWorker",
  "labTech",
  "powerQueen",
  "powerWarrior"
] as const satisfies SwarmRole[];

export type RoleBehavior = (creep: Creep) => void;

const roleBehaviors: Record<SwarmRole, RoleBehavior> = {
  larvaWorker: runLarvaWorker,
  harvester: runHarvester,
  hauler: runHauler,
  upgrader: runUpgrader,
  foragerAnt: runForagerAnt,
  builderAnt: runBuilderAnt,
  queenCarrier: runQueenCarrier,
  mineralHarvester: runMineralHarvester,
  depositHarvester: runDepositHarvester,
  terminalManager: runTerminalManager,
  scoutAnt: runScoutAnt,
  claimAnt: runClaimAnt,
  guardAnt: runGuardAnt,
  healerAnt: runHealerAnt,
  soldierAnt: runSoldierAnt,
  engineer: runEngineer,
  remoteWorker: runRemoteWorker,
  siegeUnit: runSiegeUnit,
  linkManager: runLinkManager,
  factoryWorker: runFactoryWorker,
  labTech: runLabTech,
  powerQueen: runPowerQueen,
  powerWarrior: runPowerWarrior
};

export function ensureRole(creep: Creep, fallback: SwarmRole = "larvaWorker"): SwarmRole {
  const memory = creep.memory as { role?: SwarmRole };
  if (memory.role && (SWARM_ROLES as readonly string[]).includes(memory.role)) {
    return memory.role as SwarmRole;
  }
  memory.role = fallback;
  return fallback;
}

export function runRole(creep: Creep): void {
  const role = ensureRole(creep);
  const behavior = roleBehaviors[role];
  if (behavior) behavior(creep);
}

function moveToHarvest(creep: Creep): void {
  const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
  if (!source) return;
  if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
    creep.moveTo(source, { reusePath: 5 });
  }
}

function runHarvester(creep: Creep): void {
  const creepMemory = creep.memory as { targetRoom?: string; homeRoom?: string };
  if (creepMemory.targetRoom && creep.room.name !== creepMemory.targetRoom) {
    const exit = selectExitTowards(creep.room, creepMemory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 6 });
    return;
  }
  if (creep.store.getFreeCapacity() > 0) {
    moveToHarvest(creep);
    return;
  }
  const dropTarget = creep.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK
  })[0] as StructureContainer | StructureLink | undefined;
  if (dropTarget && "store" in dropTarget) {
    transferEnergy(creep, dropTarget);
    return;
  }
  creep.drop(RESOURCE_ENERGY);
}

function runHauler(creep: Creep): void {
  if (creep.store.getUsedCapacity() === 0) {
    const target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
        (s as StructureContainer | StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > 100
    }) as StructureContainer | StructureStorage | null;
    if (target) {
      if (withdrawEnergy(creep, target) === ERR_NOT_IN_RANGE) creep.moveTo(target, { reusePath: 5 });
    }
    return;
  }
  deliverEnergy(creep);
}

function runUpgrader(creep: Creep): void {
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const storage = creep.room.storage;
    if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    } else {
      moveToHarvest(creep);
    }
    return;
  }
  if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
    creep.moveTo(creep.room.controller, { reusePath: 5 });
  }
}

function deliverEnergy(creep: Creep): void {
  const target = pickEnergyTarget(creep.room);
  if (!target) {
    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, { reusePath: 5 });
      }
    }
    return;
  }
  if (transferEnergy(creep, target) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { reusePath: 3 });
  }
}

function deliverResources(creep: Creep): void {
  const resourceType = Object.keys(creep.store).find(key => creep.store[key as ResourceConstant] > 0) as
    | ResourceConstant
    | undefined;
  if (!resourceType) return;
  const terminal = creep.room.terminal;
  const storage = creep.room.storage;
  const preferTerminal = resourceType !== RESOURCE_ENERGY && terminal;
  const target = preferTerminal ? terminal : (storage ?? terminal);
  if (!target) return;
  if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { reusePath: 4 });
  }
}

function runLarvaWorker(creep: Creep): void {
  if (creep.store.getFreeCapacity() > 0) {
    moveToHarvest(creep);
    return;
  }
  const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
  if (site) {
    if (creep.build(site) === ERR_NOT_IN_RANGE) {
      creep.moveTo(site, { reusePath: 4 });
    }
    return;
  }
  deliverEnergy(creep);
}

function runForagerAnt(creep: Creep): void {
  const creepMemory = creep.memory as { targetRoom?: string; homeRoom?: string };
  const targetRoom = creepMemory.targetRoom ?? creepMemory.homeRoom;
  if (targetRoom && creep.room.name !== targetRoom) {
    const exit = selectExitTowards(creep.room, targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 10 });
    return;
  }
  if (creep.store.getFreeCapacity() > 0) {
    moveToHarvest(creep);
    return;
  }
  deliverEnergy(creep);
}

function runBuilderAnt(creep: Creep): void {
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const storage = creep.room.storage;
    if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    } else {
      moveToHarvest(creep);
    }
    return;
  }
  const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
  if (site) {
    if (creep.build(site) === ERR_NOT_IN_RANGE) {
      creep.moveTo(site, { reusePath: 4 });
    }
    return;
  }
  if (creep.room.controller) {
    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller, { reusePath: 5 });
    }
  }
}

function runQueenCarrier(creep: Creep): void {
  const creepMemory = creep.memory as { targetRoom?: string; homeRoom?: string };
  const inTargetRoom = creepMemory.targetRoom && creep.room.name === creepMemory.targetRoom;
  const hasEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0;

  if (!hasEnergy) {
    if (creepMemory.homeRoom && creep.room.name !== creepMemory.homeRoom) {
      const exit = selectExitTowards(creep.room, creepMemory.homeRoom);
      if (exit) creep.moveTo(exit, { reusePath: 5 });
      return;
    }
    const source = creep.pos.findClosestByRange(FIND_STRUCTURES, {
      filter: s =>
        (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
        (s as StructureContainer | StructureStorage).store.getUsedCapacity(RESOURCE_ENERGY) > 200
    }) as StructureContainer | StructureStorage | null;
    if (source) {
      if (withdrawEnergy(creep, source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { reusePath: 5 });
      }
    } else {
      moveToHarvest(creep);
    }
    return;
  }

  if (creepMemory.targetRoom && !inTargetRoom) {
    const exit = selectExitTowards(creep.room, creepMemory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 5 });
    return;
  }

  deliverEnergy(creep);
}

function runMineralHarvester(creep: Creep): void {
  const creepMemory = creep.memory as { targetRoom?: string; homeRoom?: string };
  const targetRoom = creepMemory.targetRoom ?? creepMemory.homeRoom;
  if (targetRoom && creep.room.name !== targetRoom) {
    const exit = selectExitTowards(creep.room, targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 10 });
    return;
  }
  const mineral = creep.room.find(FIND_MINERALS)[0];
  const extractor = creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_EXTRACTOR } })[0];
  if (!mineral || !extractor) {
    runHauler(creep);
    return;
  }

  if (creep.store.getFreeCapacity() === 0 || mineral.mineralAmount === 0) {
    deliverResources(creep);
    return;
  }

  if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
    creep.moveTo(mineral, { reusePath: 5 });
  }
}

function runDepositHarvester(creep: Creep): void {
  const creepMemory = creep.memory as { targetRoom?: string; homeRoom?: string };
  const homeRoom = creepMemory.homeRoom ?? creep.room.name;
  const targetRoom = creepMemory.targetRoom ?? homeRoom;
  if (targetRoom && creep.room.name !== targetRoom) {
    const exit = selectExitTowards(creep.room, targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 6 });
    return;
  }

  const deposit = creep.room.find(FIND_DEPOSITS)[0];
  if (!deposit || deposit.ticksToDecay < 50) {
    deliverResources(creep);
    return;
  }

  if (creep.store.getFreeCapacity() === 0 || deposit.lastCooldown > 90) {
    deliverResources(creep);
    return;
  }

  if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
    creep.moveTo(deposit, { reusePath: 5 });
  }
}

function runTerminalManager(creep: Creep): void {
  const terminal = creep.room.terminal;
  const storage = creep.room.storage;
  if (!terminal || !storage) {
    runHauler(creep);
    return;
  }

  if (creep.store.getUsedCapacity() === 0) {
    if (
      terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 15000 &&
      storage.store.getUsedCapacity(RESOURCE_ENERGY) > 20000
    ) {
      if (withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
      return;
    }
    const nonEnergy = Object.keys(storage.store).find(
      res => res !== RESOURCE_ENERGY && storage.store[res as ResourceConstant] > 5000
    ) as ResourceConstant | undefined;
    if (nonEnergy) {
      if (creep.withdraw(storage, nonEnergy) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
      return;
    }
    if (withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
    return;
  }

  const resourceType = Object.keys(creep.store).find(key => creep.store[key as ResourceConstant] > 0) as
    | ResourceConstant
    | undefined;
  if (!resourceType) return;

  const target =
    resourceType === RESOURCE_ENERGY && terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 60000 ? storage : terminal;
  if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { reusePath: 4 });
  }
}

function runEngineer(creep: Creep): void {
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const storage = creep.room.storage;
    if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    } else {
      moveToHarvest(creep);
    }
    return;
  }
  const repairTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: s => s.hits < s.hitsMax * 0.5 && s.structureType !== STRUCTURE_WALL
  });
  if (repairTarget) {
    if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) creep.moveTo(repairTarget, { reusePath: 3 });
    return;
  }
  runBuilderAnt(creep);
}

function runRemoteWorker(creep: Creep): void {
  const creepMemory = creep.memory as { targetRoom?: string; homeRoom?: string };
  if (creepMemory.targetRoom && creep.room.name !== creepMemory.targetRoom) {
    const exit = selectExitTowards(creep.room, creepMemory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 8 });
    return;
  }
  if (creep.store.getFreeCapacity() > 0) {
    moveToHarvest(creep);
    return;
  }
  const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
  if (site) {
    if (creep.build(site) === ERR_NOT_IN_RANGE) creep.moveTo(site, { reusePath: 5 });
    return;
  }
  const repairTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: s => s.hits < s.hitsMax * 0.5 && s.structureType !== STRUCTURE_WALL
  });
  if (repairTarget) {
    if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) creep.moveTo(repairTarget, { reusePath: 4 });
    return;
  }
  if (creep.room.controller && creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
    creep.moveTo(creep.room.controller, { reusePath: 5 });
  }
}

function runScoutAnt(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string };
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    const exit = selectExitTowards(creep.room, memory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 10 });
    return;
  }
  const exits = creep.room.find(FIND_EXIT);
  if (exits.length === 0) return;
  const target = exits[Math.floor(Math.random() * exits.length)];
  if (target) creep.moveTo(target, { reusePath: 10 });
}

function runClaimAnt(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string };
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    const exit = selectExitTowards(creep.room, memory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 8 });
    return;
  }
  const ctrl = creep.room.controller;
  if (!ctrl) return;
  const result = ctrl.my ? creep.reserveController(ctrl) : creep.claimController(ctrl);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(ctrl, { reusePath: 5 });
  }
}

function runGuardAnt(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string };
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    const exit = selectExitTowards(creep.room, memory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 6 });
    return;
  }
  const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
  if (hostile) {
    if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
      creep.moveTo(hostile, { reusePath: 3 });
    }
    return;
  }
  patrol(creep);
}

function runHealerAnt(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string };
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    const exit = selectExitTowards(creep.room, memory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 6 });
    return;
  }
  const wounded = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: c => c.hits < c.hitsMax
  });
  if (wounded) {
    if (creep.heal(wounded) === ERR_NOT_IN_RANGE) {
      creep.moveTo(wounded, { reusePath: 3 });
    }
    return;
  }
  patrol(creep);
}

function runSoldierAnt(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string };
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    const exit = selectExitTowards(creep.room, memory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 6 });
    return;
  }
  const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
  if (hostile) {
    if (creep.rangedAttack(hostile) === ERR_NOT_IN_RANGE && creep.attack(hostile) === ERR_NOT_IN_RANGE) {
      creep.moveTo(hostile, { reusePath: 3 });
    }
    return;
  }
  const rally = Game.flags["Rally"];
  if (rally) creep.moveTo(rally, { reusePath: 10 });
  else patrol(creep);
}

function runSiegeUnit(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string };
  if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
    const exit = selectExitTowards(creep.room, memory.targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 6 });
    return;
  }
  const hostileStructure = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType !== STRUCTURE_CONTROLLER
  });
  if (hostileStructure) {
    if (creep.dismantle(hostileStructure) === ERR_NOT_IN_RANGE) {
      creep.moveTo(hostileStructure, { reusePath: 3 });
    }
    return;
  }
  patrol(creep);
}

function runLinkManager(creep: Creep): void {
  if (creep.store.getUsedCapacity() === 0) {
    const storage = creep.room.storage;
    const terminal = creep.room.terminal;
    const source = storage ?? terminal;
    if (source && withdrawEnergy(creep, source) === ERR_NOT_IN_RANGE) creep.moveTo(source, { reusePath: 5 });
    return;
  }
  const needyLink = creep.room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LINK && (s as StructureLink).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  })[0] as StructureLink | undefined;
  if (needyLink) {
    if (transferEnergy(creep, needyLink) === ERR_NOT_IN_RANGE) creep.moveTo(needyLink, { reusePath: 4 });
    return;
  }
  deliverEnergy(creep);
}

function runFactoryWorker(creep: Creep): void {
  const factory = creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } })[0] as
    | StructureFactory
    | undefined;
  if (!factory) {
    runHauler(creep);
    return;
  }
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const storage = creep.room.storage;
    if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
    return;
  }
  if (factory.store.getFreeCapacity() > 0) {
    if (transferEnergy(creep, factory) === ERR_NOT_IN_RANGE) creep.moveTo(factory, { reusePath: 5 });
    return;
  }
  if (factory.cooldown === 0) {
    factory.produce?.(RESOURCE_BATTERY);
  }
}

function runLabTech(creep: Creep): void {
  const labs = creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[];
  if (creep.store.getUsedCapacity() === 0) {
    const storage = creep.room.storage;
    if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
    return;
  }
  const targetLab = labs.find(lab => lab.store.getFreeCapacity(RESOURCE_ENERGY) > 0);
  if (targetLab) {
    if (transferEnergy(creep, targetLab) === ERR_NOT_IN_RANGE) creep.moveTo(targetLab, { reusePath: 4 });
    return;
  }
  runHauler(creep);
}

function findPowerStore(room: Room): StructureStorage | StructureTerminal | undefined {
  const storage = room.storage;
  if (storage && storage.store.getUsedCapacity(RESOURCE_POWER) > 0) return storage;
  const terminal = room.terminal;
  if (terminal && terminal.store.getUsedCapacity(RESOURCE_POWER) > 0) return terminal;
  return undefined;
}

function runPowerQueen(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string; homeRoom?: string };
  const targetRoom = memory.targetRoom ?? memory.homeRoom;
  if (targetRoom && creep.room.name !== targetRoom) {
    const exit = selectExitTowards(creep.room, targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 10 });
    return;
  }

  const powerSpawn = creep.room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_POWER_SPAWN
  })[0] as StructurePowerSpawn | undefined;
  const storageWithPower = powerSpawn ? findPowerStore(creep.room) : undefined;

  const droppedPower = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: res => res.resourceType === RESOURCE_POWER
  });
  if (droppedPower) {
    if (creep.pickup(droppedPower) === ERR_NOT_IN_RANGE) creep.moveTo(droppedPower, { reusePath: 4 });
    return;
  }

  if (powerSpawn) {
    if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
      if (creep.transfer(powerSpawn, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
        creep.moveTo(powerSpawn, { reusePath: 4 });
      }
      return;
    }
    if (powerSpawn.store.getUsedCapacity(RESOURCE_POWER) < 50 && storageWithPower) {
      if (creep.withdraw(storageWithPower, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storageWithPower, { reusePath: 5 });
      }
      return;
    }
    if (powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 200 && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      const storage = creep.room.storage ?? creep.room.terminal;
      if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
      return;
    }
    if (powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      if (transferEnergy(creep, powerSpawn) === ERR_NOT_IN_RANGE) creep.moveTo(powerSpawn, { reusePath: 4 });
      return;
    }
  }

  if (creep.store.getUsedCapacity() === 0) {
    const storage = creep.room.storage ?? creep.room.terminal;
    if (storage && withdrawEnergy(creep, storage) === ERR_NOT_IN_RANGE) creep.moveTo(storage, { reusePath: 5 });
    return;
  }

  deliverEnergy(creep);
}

function patrol(creep: Creep): void {
  const controller = creep.room.controller;
  if (!controller) return;
  creep.moveTo(controller, { reusePath: 10, range: 3 });
}

function runPowerWarrior(creep: Creep): void {
  const memory = creep.memory as { targetRoom?: string; homeRoom?: string };
  const targetRoom = memory.targetRoom ?? memory.homeRoom;
  if (targetRoom && creep.room.name !== targetRoom) {
    const exit = selectExitTowards(creep.room, targetRoom);
    if (exit) creep.moveTo(exit, { reusePath: 8 });
    return;
  }

  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
    filter: enemy => enemy.body.some(part => part.type === HEAL || part.type === RANGED_ATTACK || part.type === ATTACK)
  });
  const target = hostiles[0];
  if (target) {
    if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) creep.rangedAttack(target);
    if (creep.attack(target) === ERR_NOT_IN_RANGE) creep.moveTo(target, { reusePath: 4 });
    return;
  }

  const powerBank = creep.room.find(FIND_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_POWER_BANK
  })[0] as StructurePowerBank | undefined;
  if (powerBank) {
    if (creep.attack(powerBank) === ERR_NOT_IN_RANGE) creep.moveTo(powerBank, { reusePath: 5 });
    return;
  }

  patrol(creep);
}
