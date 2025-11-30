/**
 * Power Creep Manager - Phase 12
 *
 * Power goals, roles, stationing, and scheduling for power creeps.
 */

import type { SwarmState, OvermindMemory, SwarmCreepMemory } from "../memory/schemas";
// import { getConfig } from "../config";

/**
 * Get overmind memory
 */
function getOvermind(): OvermindMemory {
  const mem = Memory as unknown as Record<string, OvermindMemory>;
  return mem["overmind"]!;
}

// =============================================================================
// 12.1 Power Goals & Roles
// =============================================================================

/**
 * Power bank operation status
 */
export interface PowerBankOperation {
  roomName: string;
  pos: { x: number; y: number };
  power: number;
  decayTick: number;
  harvestersAssigned: string[];
  carriersAssigned: string[];
  status: "scouting" | "harvesting" | "collecting" | "complete" | "abandoned";
}

/**
 * Calculate power bank profitability
 */
export function calculatePowerBankProfitability(
  powerBank: { power: number; hits: number; decayTime: number },
  distance: number,
  harvestersNeeded: number
): { profitable: boolean; netPower: number; reason: string } {
  // Power bank has 2M hits, takes ~100 ATTACK parts to kill in time
  const damageNeeded = powerBank.hits;
  const damagePerTick = harvestersNeeded * 30; // ATTACK does 30 damage (1 tick per attack)

  const ticksToKill = damageNeeded / damagePerTick;
  const travelTime = distance * 50; // Rough estimate

  // Check if we can kill it in time
  if (ticksToKill + travelTime > powerBank.decayTime) {
    return { profitable: false, netPower: 0, reason: "Not enough time" };
  }

  // Calculate costs
  const harvesterCost = harvestersNeeded * 5000; // Rough body cost
  const carrierCost = Math.ceil(powerBank.power / 1600) * 1500; // Carriers needed

  // Power value (assuming ~0.1 credits per power unit)
  const powerValue = powerBank.power;

  const netPower = powerValue - (harvesterCost + carrierCost) / 100;

  return {
    profitable: netPower > 0,
    netPower,
    reason: netPower > 0 ? "Profitable" : "Not worth it"
  };
}

/**
 * Find power banks in known rooms
 */
export function findPowerBanks(): StructurePowerBank[] {
  const powerBanks: StructurePowerBank[] = [];

  for (const roomName of Object.keys(Game.rooms)) {
    const room = Game.rooms[roomName];
    if (!room) continue;

    const banks = room.find(FIND_STRUCTURES, {
      filter: s => s.structureType === STRUCTURE_POWER_BANK
    }) as StructurePowerBank[];

    powerBanks.push(...banks);
  }

  return powerBanks;
}

/**
 * Track power bank operation
 */
export function trackPowerBankOperation(powerBank: StructurePowerBank): PowerBankOperation {
  const overmind = getOvermind();

  // Check if already tracking
  const existing = overmind.powerBanks.find(p => p.roomName === powerBank.room?.name);
  if (existing) {
    // Update
    existing.power = powerBank.power;
    existing.decayTick = Game.time + (powerBank.ticksToDecay ?? 0);
    return existing as unknown as PowerBankOperation;
  }

  // Create new tracking
  const operation: PowerBankOperation = {
    roomName: powerBank.room?.name ?? "",
    pos: { x: powerBank.pos.x, y: powerBank.pos.y },
    power: powerBank.power,
    decayTick: Game.time + (powerBank.ticksToDecay ?? 0),
    harvestersAssigned: [],
    carriersAssigned: [],
    status: "scouting"
  };

  overmind.powerBanks.push({
    roomName: operation.roomName,
    pos: operation.pos,
    power: operation.power,
    decayTick: operation.decayTick,
    active: false
  });

  return operation;
}

/**
 * Process power in room
 */
export function canProcessPower(room: Room): boolean {
  // Need RCL 8 with power spawn
  if (!room.controller || room.controller.level < 8) return false;

  const powerSpawn = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_POWER_SPAWN
  })[0] as StructurePowerSpawn | undefined;

  if (!powerSpawn) return false;

  // Check if we have power and energy
  const hasPower = powerSpawn.store.getUsedCapacity(RESOURCE_POWER) >= 1;
  const hasEnergy = powerSpawn.store.getUsedCapacity(RESOURCE_ENERGY) >= 50;

  return hasPower && hasEnergy;
}

/**
 * Run power processing
 */
export function runPowerProcessing(room: Room): void {
  if (!canProcessPower(room)) return;

  const powerSpawn = room.find(FIND_MY_STRUCTURES, {
    filter: s => s.structureType === STRUCTURE_POWER_SPAWN
  })[0] as StructurePowerSpawn | undefined;

  if (powerSpawn) {
    powerSpawn.processPower();
  }
}

// =============================================================================
// 12.2 Power Creep Stationing & Scheduling
// =============================================================================

/**
 * Power creep assignment
 */
export interface PowerCreepAssignment {
  powerCreepName: string;
  homeRoom: string;
  secondaryRooms: string[];
  role: "powerQueen" | "powerWarrior";
  schedule: {
    lastAbilityUse: Record<PowerConstant, number>;
    abilityPriority: PowerConstant[];
  };
}

/**
 * Get power creeps
 */
export function getPowerCreeps(): PowerCreep[] {
  return Object.values(Game.powerCreeps).filter(pc => pc.ticksToLive !== undefined);
}

/**
 * Assign power creep to room
 */
export function assignPowerCreepToRoom(
  powerCreep: PowerCreep,
  roomName: string,
  role: "powerQueen" | "powerWarrior"
): void {
  const memory = powerCreep.memory as unknown as SwarmCreepMemory;
  memory.homeRoom = roomName;
  memory.role = role;
  memory.family = "power";
}

/**
 * Get available powers for power creep
 */
export function getAvailablePowers(powerCreep: PowerCreep): PowerConstant[] {
  const powers: PowerConstant[] = [];

  for (const [powerStr, power] of Object.entries(powerCreep.powers)) {
    const powerConst = parseInt(powerStr, 10) as PowerConstant;
    if (power.cooldown === 0) {
      powers.push(powerConst);
    }
  }

  return powers;
}

/**
 * Get power priority for role
 */
export function getPowerPriority(role: "powerQueen" | "powerWarrior"): PowerConstant[] {
  if (role === "powerQueen") {
    return [
      PWR_GENERATE_OPS,
      PWR_OPERATE_SPAWN,
      PWR_OPERATE_EXTENSION,
      PWR_OPERATE_STORAGE,
      PWR_OPERATE_LAB,
      PWR_OPERATE_FACTORY,
      PWR_REGEN_SOURCE,
      PWR_REGEN_MINERAL
    ];
  } else {
    return [
      PWR_GENERATE_OPS,
      PWR_SHIELD,
      PWR_OPERATE_TOWER,
      PWR_DISRUPT_SPAWN,
      PWR_DISRUPT_TOWER,
      PWR_FORTIFY,
      PWR_DISRUPT_SOURCE
    ];
  }
}

/**
 * Should use power ability
 */
export function shouldUsePower(powerCreep: PowerCreep, power: PowerConstant, room: Room, swarm: SwarmState): boolean {
  const ops = powerCreep.store.getUsedCapacity(RESOURCE_OPS);

  // Need ops for most abilities
  if (power !== PWR_GENERATE_OPS && ops < 10) {
    return false;
  }

  switch (power) {
    case PWR_GENERATE_OPS:
      // Generate ops if low
      return ops < 50;

    case PWR_OPERATE_SPAWN:
      // Use if spawn is spawning
      const spawns = room.find(FIND_MY_SPAWNS);
      return spawns.some(s => s.spawning !== null);

    case PWR_OPERATE_EXTENSION:
      // Use if many extensions empty
      const extensions = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_EXTENSION
      }) as StructureExtension[];
      const emptyCount = extensions.filter(e => e.store.getFreeCapacity(RESOURCE_ENERGY) > 0).length;
      return emptyCount > 10;

    case PWR_OPERATE_STORAGE:
      // Use if storage exists
      return room.storage !== undefined;

    case PWR_OPERATE_LAB:
      // Use if labs running reactions
      const labs = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_LAB
      }) as StructureLab[];
      return labs.some(l => l.cooldown > 0);

    case PWR_OPERATE_FACTORY:
      // Use if factory has work
      const factory = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_FACTORY
      })[0] as StructureFactory | undefined;
      return factory !== undefined && factory.cooldown > 0;

    case PWR_OPERATE_TOWER:
      // Use in combat
      return swarm.danger > 0;

    case PWR_SHIELD:
      // Use if taking damage
      return powerCreep.hits < powerCreep.hitsMax * 0.8;

    case PWR_DISRUPT_SPAWN:
    case PWR_DISRUPT_TOWER:
      // Use in enemy rooms
      return room.find(FIND_HOSTILE_STRUCTURES).length > 0;

    case PWR_FORTIFY:
      // Use if ramparts weak
      const ramparts = room.find(FIND_MY_STRUCTURES, {
        filter: s => s.structureType === STRUCTURE_RAMPART
      }) as StructureRampart[];
      return ramparts.some(r => r.hits < 100000);

    case PWR_REGEN_SOURCE:
      // Use if sources depleted
      const sources = room.find(FIND_SOURCES);
      return sources.some(s => s.energy < s.energyCapacity * 0.5);

    case PWR_REGEN_MINERAL:
      // Use if mineral depleted
      const mineral = room.find(FIND_MINERALS)[0];
      return mineral !== undefined && mineral.mineralAmount === 0;

    default:
      return false;
  }
}

/**
 * Run power creep manager
 */
export function runPowerCreepManager(ownedRooms: string[], swarms: Map<string, SwarmState>): void {
  const powerCreeps = getPowerCreeps();

  // Run power processing in RCL 8 rooms
  for (const roomName of ownedRooms) {
    const room = Game.rooms[roomName];
    if (room && room.controller?.level === 8) {
      runPowerProcessing(room);
    }
  }

  // Assign unassigned power creeps
  for (const powerCreep of powerCreeps) {
    const memory = powerCreep.memory as unknown as SwarmCreepMemory;

    if (!memory.homeRoom) {
      // Find best room (RCL 8 with most activity)
      let bestRoom: string | null = null;
      let bestScore = 0;

      for (const roomName of ownedRooms) {
        const room = Game.rooms[roomName];
        if (!room || !room.controller || room.controller.level < 8) continue;

        const swarm = swarms.get(roomName);
        if (!swarm) continue;

        // Score based on activity
        const score = swarm.metrics.energyHarvested + swarm.metrics.controllerProgress;
        if (score > bestScore) {
          bestScore = score;
          bestRoom = roomName;
        }
      }

      if (bestRoom) {
        assignPowerCreepToRoom(powerCreep, bestRoom, "powerQueen");
      }
    }
  }

  // Clean up power bank tracking
  const overmind = getOvermind();
  overmind.powerBanks = overmind.powerBanks.filter(pb => pb.decayTick > Game.time);
}
