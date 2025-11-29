/**
 * Helper functions for creep behavior management
 */

import type { CreepLike } from "@runtime/types/GameContext";

/**
 * Determines if a creep is still spawning and cannot perform actions.
 * Spawning creeps should be skipped during behavior execution to avoid
 * errors like "Pathfinder: can't move creep that is spawning".
 *
 * @param creep - The creep to check
 * @returns true if the creep is still spawning
 */
export function isCreepSpawning(creep: CreepLike): boolean {
  return creep.spawning === true;
}

/**
 * Determines if a creep is dying (low TTL) and should drop its carried resources.
 *
 * @param creep - The creep to check
 * @param threshold - Minimum ticks to live before considering a creep as dying (default: 50)
 * @returns true if the creep's ticksToLive is below the threshold
 */
export function isCreepDying(creep: Creep, threshold: number = 50): boolean {
  return creep.ticksToLive !== undefined && creep.ticksToLive < threshold;
}

/**
 * Handles energy dropping behavior for dying creeps.
 * Drops all carried energy at the creep's current position.
 *
 * @param creep - The dying creep
 * @returns true if energy was dropped, false otherwise
 */
export function handleDyingCreepEnergyDrop(creep: Creep): boolean {
  const energyCarried = creep.store.getUsedCapacity(RESOURCE_ENERGY);

  if (energyCarried > 0) {
    const result = creep.drop(RESOURCE_ENERGY);
    if (result === OK) {
      return true;
    }
  }

  return false;
}
