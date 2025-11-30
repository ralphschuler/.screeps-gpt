/**
 * Type definitions for swarm behavior trees.
 * Extends the base xtree types with swarm-specific context and actions.
 *
 * @packageDocumentation
 */

import type { SwarmRole } from "../types.js";

/**
 * Decision context for swarm creeps.
 * Contains all necessary information for making behavior decisions.
 */
export interface SwarmCreepContext {
  /** The creep making the decision */
  creep: Creep;

  /** The room the creep is in */
  room: Room;

  /** Creep's home room name */
  homeRoom: string;

  /** Target room name if assigned */
  targetRoom: string | undefined;

  /** Current task identifier */
  task: string | undefined;

  /** Assigned source ID */
  sourceId: Id<Source> | undefined;

  /** Target structure or creep ID */
  targetId: Id<Structure | Creep | Resource> | undefined;

  /** Creep's role */
  role: SwarmRole;

  /** Whether energy sources are available */
  energyAvailable: boolean;

  /** Whether hostile creeps are nearby */
  nearbyEnemies: boolean;

  /** Number of construction sites in the room */
  constructionSites: number;

  /** Number of damaged structures in the room */
  damagedStructures: number;

  /** Energy in storage */
  storageEnergy: number;

  /** Whether terminal exists */
  hasTerminal: boolean;

  /** Whether extractor exists */
  hasExtractor: boolean;

  /** Available mineral in room */
  mineralAmount: number;
}

/**
 * Action types that creeps can perform.
 */
export type SwarmAction =
  | { type: "harvest" }
  | { type: "harvestMineral" }
  | { type: "harvestDeposit" }
  | { type: "transfer" }
  | { type: "withdraw" }
  | { type: "build" }
  | { type: "upgrade" }
  | { type: "repair" }
  | { type: "attack" }
  | { type: "rangedAttack" }
  | { type: "heal" }
  | { type: "claim" }
  | { type: "reserve" }
  | { type: "flee" }
  | { type: "moveTo"; target: string }
  | { type: "patrol" }
  | { type: "manageTerminal" }
  | { type: "manageLink" }
  | { type: "manageLab" }
  | { type: "manageFactory" }
  | { type: "managePower" }
  | { type: "dismantle" }
  | { type: "pickup" }
  | { type: "drop" }
  | { type: "idle" };

/**
 * Creates a SwarmCreepContext from a creep.
 */
export function createSwarmContext(creep: Creep): SwarmCreepContext {
  const memory = creep.memory as {
    role?: SwarmRole;
    homeRoom?: string;
    targetRoom?: string;
    task?: string;
    sourceId?: Id<Source>;
    targetId?: Id<Structure | Creep | Resource>;
  };

  const room = creep.room;
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  const sources = room.find(FIND_SOURCES_ACTIVE);
  const sites = room.find(FIND_CONSTRUCTION_SITES);
  // Count structures below 80% health for damagedStructures metric (liberal threshold)
  // Note: Repair action uses 50% threshold for prioritization (critical damage)
  const damaged = room.find(FIND_STRUCTURES, {
    filter: s => s.hits < s.hitsMax * 0.8 && s.structureType !== STRUCTURE_WALL
  });
  const mineral = room.find(FIND_MINERALS)[0];
  const extractor = room.find(FIND_MY_STRUCTURES, {
    filter: { structureType: STRUCTURE_EXTRACTOR }
  })[0];

  return {
    creep,
    room,
    homeRoom: memory.homeRoom ?? room.name,
    targetRoom: memory.targetRoom,
    task: memory.task,
    sourceId: memory.sourceId,
    targetId: memory.targetId,
    role: memory.role ?? "larvaWorker",
    energyAvailable: sources.length > 0,
    nearbyEnemies: hostiles.length > 0,
    constructionSites: sites.length,
    damagedStructures: damaged.length,
    storageEnergy: room.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0,
    hasTerminal: !!room.terminal,
    hasExtractor: !!extractor,
    mineralAmount: mineral?.mineralAmount ?? 0
  };
}
