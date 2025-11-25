/**
 * Shared helper utilities for role controllers
 */

import type { CreepLike } from "@runtime/types/GameContext";

/**
 * Type constraint for objects with room positions
 */
interface _HasRoomPosition {
  pos: RoomPosition;
}

/**
 * Room center coordinates for inter-room navigation
 */
export const ROOM_CENTER_X = 25;
export const ROOM_CENTER_Y = 25;

/**
 * Helper function to find the closest target by path or fall back to the first target.
 * Reduces code duplication throughout role controllers.
 *
 * @param creep - The creep to find a path from
 * @param targets - Array of potential targets
 * @returns The closest target by path, or the first target if pathfinding fails, or null if no targets
 */
export function findClosestOrFirst<T extends _HasRoomPosition>(creep: CreepLike, targets: T[]): T | null {
  if (targets.length === 0) {
    return null;
  }
  return creep.pos.findClosestByPath(targets) ?? targets[0];
}

/**
 * Helper function to pick up nearby dropped energy if the creep has capacity.
 * Returns true if the creep picked up or is moving to pick up energy.
 *
 * @param creep - The creep that should pick up energy
 * @param minAmount - Minimum amount of energy to consider picking up (default: 50)
 * @returns true if energy pickup is in progress, false otherwise
 */
export function tryPickupDroppedEnergy(creep: CreepLike, minAmount = 50): boolean {
  // Only pick up if creep has capacity
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    return false;
  }

  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= minAmount
  }) as Resource[];

  if (droppedEnergy.length === 0) {
    return false;
  }

  const closest = creep.pos.findClosestByPath(droppedEnergy);
  const target = closest ?? droppedEnergy[0];

  const result = creep.pickup(target);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { range: 1, reusePath: 10 });
    return true;
  } else if (result === OK) {
    return true;
  }

  return false;
}

/**
 * Determines if a structure is a valid energy source that creeps can withdraw from.
 * Valid sources include containers and storage, but NOT spawns, extensions, or towers.
 *
 * @param structure - The structure to check
 * @param minEnergy - Minimum energy threshold (default: 0)
 * @returns true if the structure is a valid energy source for withdrawal
 */
export function isValidEnergySource(structure: AnyStructure, minEnergy: number = 0): boolean {
  // Only containers and storage are valid withdrawal sources
  if (structure.structureType !== STRUCTURE_CONTAINER && structure.structureType !== STRUCTURE_STORAGE) {
    return false;
  }

  const store = structure as AnyStoreStructure;
  return store.store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy;
}

/**
 * Finds containers adjacent to spawns in a room.
 * Helper function to avoid duplicate find operations in hauler logic.
 *
 * @param room - The room to search in
 * @param minEnergy - Optional minimum energy threshold to filter containers
 * @returns Array of containers adjacent to spawns
 */
export function findSpawnAdjacentContainers(
  room: { find: (constant: number, opts?: unknown) => unknown[] },
  minEnergy?: number
): StructureContainer[] {
  const spawns = room.find(FIND_MY_SPAWNS) as StructureSpawn[];
  const containers: StructureContainer[] = [];

  for (const spawn of spawns) {
    const nearbyStructures = spawn.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
    });

    for (const structure of nearbyStructures) {
      const container = structure as StructureContainer;
      if (minEnergy !== undefined) {
        const currentEnergy = container.store.getUsedCapacity(RESOURCE_ENERGY);
        if (currentEnergy < minEnergy && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          containers.push(container);
        }
      } else if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        containers.push(container);
      }
    }
  }

  return containers;
}

/**
 * Finds towers in a room that are below the minimum energy threshold.
 * Used by both harvesters and haulers to identify towers that need refilling.
 *
 * @param room - The room to search for towers
 * @param minCapacityRatio - Minimum capacity ratio (0-1) to maintain (default: 0.5 for 50%)
 * @returns Array of towers below the threshold
 */
export function findLowEnergyTowers(
  room: { find: (constant: number, opts?: unknown) => unknown[] },
  minCapacityRatio: number = 0.5
): StructureTower[] {
  const towers = room.find(FIND_STRUCTURES, {
    filter: (structure: AnyStructure) => {
      if (structure.structureType !== STRUCTURE_TOWER) return false;
      const capacity = structure.store.getCapacity(RESOURCE_ENERGY);
      const used = structure.store.getUsedCapacity(RESOURCE_ENERGY);
      return used < capacity * minCapacityRatio;
    }
  }) as StructureTower[];

  return towers;
}

/**
 * Helper function to move a creep to a target room.
 * Handles finding exit direction and navigating to room exits.
 * When at room edge (including after entering target room), moves toward room center
 * to avoid oscillation and cycling back through exits.
 *
 * @param creep - The creep to move
 * @param targetRoom - Target room name
 * @param reusePath - Path reuse parameter
 * @returns true if the creep is still moving (not yet safely in target room interior), false if done
 */
export function moveToTargetRoom(creep: CreepLike, targetRoom: string, reusePath: number = 50): boolean {
  // Check if creep is at room edge (coordinates 0 or 49)
  const atEdge = creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49;

  if (creep.room.name === targetRoom) {
    // If in target room but at edge, move toward center to avoid cycling back through exit
    if (atEdge) {
      creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, targetRoom), { reusePath: 0 });
      return true;
    }
    return false;
  }

  // If at edge (not in target room), move directly to target room center to avoid oscillation
  // Use reusePath: 0 to force fresh pathfinding and prevent cached path issues at room boundaries
  if (atEdge) {
    creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, targetRoom), { reusePath: 0 });
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  const exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(targetRoom);
  if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
    const exitPositions = creep.room.find(exitDir as ExitConstant) as RoomPosition[];
    if (exitPositions.length > 0) {
      const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions);
      const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
      creep.moveTo(actualExitPos, { reusePath });
      return true;
    }
  }
  return false;
}
