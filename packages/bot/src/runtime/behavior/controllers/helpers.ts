/**
 * Shared helper utilities for role controllers
 */

import type { CreepLike } from "@runtime/types/GameContext";

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
