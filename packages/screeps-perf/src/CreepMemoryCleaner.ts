/// <reference types="@types/screeps" />

/**
 * CreepMemoryCleaner - Automatically removes memory for dead creeps
 *
 * Memory cleanup for dead creeps reduces the initial memory parse time each tick.
 * This module runs periodically (every 100 ticks) to clean up stale creep memory.
 */

/**
 * Cleans up memory for dead creeps
 * Runs at most once per 100 ticks to avoid excessive CPU usage
 */
export function cleanUpCreepMemory(): void {
  if (!Memory.screepsPerf) {
    Memory.screepsPerf = {
      lastMemoryCleanUp: Game.time
    };
  }

  if (Game.time - Memory.screepsPerf.lastMemoryCleanUp > 100) {
    Object.keys(Memory.creeps).forEach(creepName => {
      if (!Game.creeps[creepName]) {
        delete Memory.creeps[creepName];
      }
    });
    Memory.screepsPerf.lastMemoryCleanUp = Game.time;
  }
}

/**
 * Patches Spawn.prototype.createCreep to automatically trigger memory cleanup
 * This ensures memory is cleaned up without requiring explicit calls from user code
 */
export function setupCreepMemoryCleaner(): void {
  const originalCreateCreep = StructureSpawn.prototype.createCreep;

  StructureSpawn.prototype.createCreep = function (
    this: StructureSpawn,
    ...args: Parameters<typeof originalCreateCreep>
  ): ReturnType<typeof originalCreateCreep> {
    cleanUpCreepMemory();
    return originalCreateCreep.apply(this, args);
  };
}
