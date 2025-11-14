/**
 * Helper functions for creep behavior management
 */

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
