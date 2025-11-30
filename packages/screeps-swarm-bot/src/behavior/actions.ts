/**
 * Swarm-specific actions for decision tree execution.
 * These actions are executed after the decision tree evaluates to a result.
 * 
 * @packageDocumentation
 */

import type { SwarmCreepContext, SwarmAction } from "./types.js";
import { selectExitTowards } from "../roles/navigation.js";

/**
 * Executes the given action on the creep.
 */
export function executeAction(ctx: SwarmCreepContext, action: SwarmAction): void {
  const { creep } = ctx;
  
  switch (action.type) {
    case "harvest":
      harvestEnergy(creep);
      break;
      
    case "harvestMineral":
      harvestMineral(creep);
      break;
      
    case "harvestDeposit":
      harvestDeposit(creep);
      break;
      
    case "transfer":
      transferToTarget(creep);
      break;
      
    case "withdraw":
      withdrawFromTarget(creep);
      break;
      
    case "build":
      buildSite(creep);
      break;
      
    case "upgrade":
      upgradeController(creep);
      break;
      
    case "repair":
      repairStructure(creep);
      break;
      
    case "attack":
      attackHostile(creep);
      break;
      
    case "rangedAttack":
      rangedAttackHostile(creep);
      break;
      
    case "heal":
      healAlly(creep);
      break;
      
    case "claim":
      claimController(creep);
      break;
      
    case "reserve":
      reserveController(creep);
      break;
      
    case "flee":
      fleeFromHostiles(creep);
      break;
      
    case "moveTo":
      moveToRoom(creep, action.target);
      break;
      
    case "patrol":
      patrol(creep);
      break;
      
    case "manageTerminal":
      manageTerminal(creep);
      break;
      
    case "manageLink":
      manageLink(creep);
      break;
      
    case "manageLab":
      manageLab(creep);
      break;
      
    case "manageFactory":
      manageFactory(creep);
      break;
      
    case "managePower":
      managePowerSpawn(creep);
      break;
      
    case "dismantle":
      dismantleStructure(creep);
      break;
      
    case "pickup":
      pickupResource(creep);
      break;
      
    case "drop":
      dropEnergy(creep);
      break;
      
    case "idle":
    default:
      // Do nothing
      break;
  }
}

// Energy harvesting

function harvestEnergy(creep: Creep): void {
  const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
  if (!source) return;
  if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
    creep.moveTo(source, { reusePath: 5 });
  }
}

function harvestMineral(creep: Creep): void {
  const mineral = creep.room.find(FIND_MINERALS)[0];
  if (!mineral) return;
  if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
    creep.moveTo(mineral, { reusePath: 5 });
  }
}

function harvestDeposit(creep: Creep): void {
  const deposit = creep.room.find(FIND_DEPOSITS)[0];
  if (!deposit || deposit.ticksToDecay < 50) return;
  if (creep.harvest(deposit) === ERR_NOT_IN_RANGE) {
    creep.moveTo(deposit, { reusePath: 5 });
  }
}

// Transfer actions

function transferToTarget(creep: Creep): void {
  // Priority: spawns/extensions > towers > storage > terminal
  const spawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: s =>
      (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
      (s as StructureSpawn | StructureExtension).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  });
  
  if (spawn) {
    if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(spawn, { reusePath: 3 });
    }
    return;
  }
  
  const tower = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
    filter: s =>
      s.structureType === STRUCTURE_TOWER &&
      (s as StructureTower).store.getFreeCapacity(RESOURCE_ENERGY) > 100
  });
  
  if (tower) {
    if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(tower, { reusePath: 3 });
    }
    return;
  }
  
  const storage = creep.room.storage;
  if (storage && storage.store.getFreeCapacity() > 0) {
    if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    }
    return;
  }
  
  const terminal = creep.room.terminal;
  if (terminal && terminal.store.getFreeCapacity() > 0) {
    if (creep.transfer(terminal, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(terminal, { reusePath: 5 });
    }
  }
}

function withdrawFromTarget(creep: Creep): void {
  // Priority: storage > containers
  const storage = creep.room.storage;
  if (storage && storage.store.getUsedCapacity(RESOURCE_ENERGY) > 200) {
    if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    }
    return;
  }
  
  const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: s =>
      s.structureType === STRUCTURE_CONTAINER &&
      (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 100
  }) as StructureContainer | null;
  
  if (container) {
    if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(container, { reusePath: 5 });
    }
  }
}

// Work actions

function buildSite(creep: Creep): void {
  const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
  if (!site) return;
  if (creep.build(site) === ERR_NOT_IN_RANGE) {
    creep.moveTo(site, { reusePath: 4 });
  }
}

function upgradeController(creep: Creep): void {
  const controller = creep.room.controller;
  if (!controller) return;
  if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, { reusePath: 5 });
  }
}

// Repair threshold for prioritizing repair action (critical damage)
const REPAIR_CRITICAL_THRESHOLD = 0.5;

function repairStructure(creep: Creep): void {
  // Target structures below critical threshold for repair priority
  const target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
    filter: s => s.hits < s.hitsMax * REPAIR_CRITICAL_THRESHOLD && s.structureType !== STRUCTURE_WALL
  });
  if (!target) return;
  if (creep.repair(target) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { reusePath: 3 });
  }
}

// Combat actions

function attackHostile(creep: Creep): void {
  const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
  if (!hostile) return;
  if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
    creep.moveTo(hostile, { reusePath: 3 });
  }
}

function rangedAttackHostile(creep: Creep): void {
  const hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
  if (!hostile) return;
  if (creep.rangedAttack(hostile) === ERR_NOT_IN_RANGE) {
    creep.moveTo(hostile, { reusePath: 3 });
  }
}

function healAlly(creep: Creep): void {
  const wounded = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
    filter: c => c.hits < c.hitsMax
  });
  if (!wounded) return;
  if (creep.heal(wounded) === ERR_NOT_IN_RANGE) {
    creep.moveTo(wounded, { reusePath: 3 });
  }
}

// Claim actions

function claimController(creep: Creep): void {
  const controller = creep.room.controller;
  if (!controller) return;
  // If already owned, nothing to do (upgrade instead)
  // If reserved by us, try to claim; otherwise claim if unowned or reserve if owned by others
  let result: ScreepsReturnCode;
  if (controller.my) {
    // Already owned, upgrade it instead
    result = creep.upgradeController(controller);
  } else if (!controller.owner) {
    // Unowned, try to claim
    result = creep.claimController(controller);
  } else {
    // Owned by someone else, just move to it
    result = ERR_NOT_IN_RANGE;
  }
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, { reusePath: 5 });
  }
}

function reserveController(creep: Creep): void {
  const controller = creep.room.controller;
  if (!controller) return;
  if (creep.reserveController(controller) === ERR_NOT_IN_RANGE) {
    creep.moveTo(controller, { reusePath: 5 });
  }
}

// Movement actions

function fleeFromHostiles(creep: Creep): void {
  const hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
  if (hostiles.length === 0) return;
  
  let avgX = 0, avgY = 0;
  for (const hostile of hostiles) {
    avgX += hostile.pos.x;
    avgY += hostile.pos.y;
  }
  avgX = Math.floor(avgX / hostiles.length);
  avgY = Math.floor(avgY / hostiles.length);
  
  const dx = creep.pos.x - avgX;
  const dy = creep.pos.y - avgY;
  const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
  const targetX = Math.max(1, Math.min(48, creep.pos.x + Math.round((dx / magnitude) * 5)));
  const targetY = Math.max(1, Math.min(48, creep.pos.y + Math.round((dy / magnitude) * 5)));
  
  creep.moveTo(new RoomPosition(targetX, targetY, creep.room.name), {
    reusePath: 0,
    ignoreCreeps: true
  });
}

function moveToRoom(creep: Creep, targetRoom: string): void {
  if (creep.room.name === targetRoom) return;
  const exit = selectExitTowards(creep.room, targetRoom);
  if (exit) {
    creep.moveTo(exit, { reusePath: 10 });
  }
}

function patrol(creep: Creep): void {
  const controller = creep.room.controller;
  if (!controller) return;
  creep.moveTo(controller, { reusePath: 10, range: 3 });
}

// Structure management

function manageTerminal(creep: Creep): void {
  const terminal = creep.room.terminal;
  const storage = creep.room.storage;
  if (!terminal || !storage) return;
  
  if (creep.store.getUsedCapacity() === 0) {
    // Withdraw from storage to fill terminal if needed
    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 15000 && 
        storage.store.getUsedCapacity(RESOURCE_ENERGY) > 20000) {
      if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { reusePath: 5 });
      }
      return;
    }
    // Move minerals from storage to terminal
    const nonEnergy = Object.keys(storage.store).find(
      res => res !== RESOURCE_ENERGY && storage.store[res as ResourceConstant] > 5000
    ) as ResourceConstant | undefined;
    if (nonEnergy) {
      if (creep.withdraw(storage, nonEnergy) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { reusePath: 5 });
      }
      return;
    }
  }
  
  // Transfer to terminal
  const resourceType = Object.keys(creep.store).find(
    key => creep.store[key as ResourceConstant] > 0
  ) as ResourceConstant | undefined;
  if (!resourceType) return;
  
  const target = resourceType === RESOURCE_ENERGY && 
                 terminal.store.getUsedCapacity(RESOURCE_ENERGY) > 60000 ? storage : terminal;
  if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { reusePath: 4 });
  }
}

function manageLink(creep: Creep): void {
  if (creep.store.getUsedCapacity() === 0) {
    const storage = creep.room.storage ?? creep.room.terminal;
    if (storage && creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    }
    return;
  }
  
  const link = creep.room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_LINK && 
                 (s as StructureLink).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  })[0] as StructureLink | undefined;
  
  if (link) {
    if (creep.transfer(link, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(link, { reusePath: 4 });
    }
  }
}

function manageLab(creep: Creep): void {
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const storage = creep.room.storage;
    if (storage && creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    }
    return;
  }
  
  const lab = creep.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_LAB }
  }).find(l => (l as StructureLab).store.getFreeCapacity(RESOURCE_ENERGY) > 0) as StructureLab | undefined;
  
  if (lab) {
    if (creep.transfer(lab, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(lab, { reusePath: 4 });
    }
  }
}

function manageFactory(creep: Creep): void {
  const factory = creep.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_FACTORY }
  })[0] as StructureFactory | undefined;
  if (!factory) return;
  
  if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
    const storage = creep.room.storage;
    if (storage && creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    }
    return;
  }
  
  if (factory.store.getFreeCapacity() > 0) {
    if (creep.transfer(factory, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(factory, { reusePath: 5 });
    }
  }
}

function managePowerSpawn(creep: Creep): void {
  const powerSpawn = creep.room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_POWER_SPAWN }
  })[0] as StructurePowerSpawn | undefined;
  if (!powerSpawn) return;
  
  // Check for dropped power
  const droppedPower = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_POWER
  });
  if (droppedPower) {
    if (creep.pickup(droppedPower) === ERR_NOT_IN_RANGE) {
      creep.moveTo(droppedPower, { reusePath: 4 });
    }
    return;
  }
  
  // Transfer power if we have it
  if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
    if (creep.transfer(powerSpawn, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
      creep.moveTo(powerSpawn, { reusePath: 4 });
    }
    return;
  }
  
  // Get power from storage if power spawn needs it
  const storage = creep.room.storage ?? creep.room.terminal;
  if (powerSpawn.store.getUsedCapacity(RESOURCE_POWER) < 50 && storage?.store.getUsedCapacity(RESOURCE_POWER)) {
    if (creep.withdraw(storage, RESOURCE_POWER) === ERR_NOT_IN_RANGE) {
      creep.moveTo(storage, { reusePath: 5 });
    }
    return;
  }
  
  // Fill power spawn with energy if needed
  if (powerSpawn.store.getFreeCapacity(RESOURCE_ENERGY) > 200) {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 && storage) {
      if (creep.withdraw(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, { reusePath: 5 });
      }
    } else if (creep.transfer(powerSpawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(powerSpawn, { reusePath: 4 });
    }
  }
}

function dismantleStructure(creep: Creep): void {
  const target = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, {
    filter: s => s.structureType !== STRUCTURE_CONTROLLER
  });
  if (!target) return;
  if (creep.dismantle(target) === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { reusePath: 3 });
  }
}

function pickupResource(creep: Creep): void {
  const resource = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES);
  if (!resource) return;
  if (creep.pickup(resource) === ERR_NOT_IN_RANGE) {
    creep.moveTo(resource, { reusePath: 3 });
  }
}

function dropEnergy(creep: Creep): void {
  const container = creep.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_LINK
  })[0];
  
  if (container && "store" in container) {
    creep.transfer(container, RESOURCE_ENERGY);
  } else {
    creep.drop(RESOURCE_ENERGY);
  }
}

/**
 * Registry of all action executors.
 */
export const swarmActions = {
  executeAction,
  harvestEnergy,
  harvestMineral,
  harvestDeposit,
  transferToTarget,
  withdrawFromTarget,
  buildSite,
  upgradeController,
  repairStructure,
  attackHostile,
  rangedAttackHostile,
  healAlly,
  claimController,
  reserveController,
  fleeFromHostiles,
  moveToRoom,
  patrol,
  manageTerminal,
  manageLink,
  manageLab,
  manageFactory,
  managePowerSpawn,
  dismantleStructure,
  pickupResource,
  dropEnergy
};
