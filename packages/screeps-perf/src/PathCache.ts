/// <reference types="@types/screeps" />

import { cleanUpCreepMemory } from "./CreepMemoryCleaner.js";

/**
 * PathCache - Caches Room.findPath results to avoid expensive recalculations
 *
 * Pathfinding is one of the most CPU-intensive operations in Screeps.
 * This module caches path results in Memory and reuses them as long as:
 * - The path is used at least once every 300 ticks
 * - The path is less than 2000 ticks old
 *
 * This helps ensure creeps respond to changing room terrain while avoiding
 * unnecessary pathfinding calculations.
 */

let originalFindPath: typeof Room.prototype.findPath;

/**
 * Creates a unique identifier for a path based on start and end positions
 */
function roomPositionIdentifier(roomPosition: RoomPosition): string {
  return roomPosition.roomName + "x" + roomPosition.x + "y" + roomPosition.y;
}

/**
 * Optimized Room.prototype.findPath with caching
 */
function optimizedFindPath(this: Room, fromPos: RoomPosition, toPos: RoomPosition, opts?: FindPathOpts): PathStep[] {
  // Also trigger creep memory cleanup when pathfinding
  cleanUpCreepMemory();

  if (!Memory.pathOptimizer) {
    Memory.pathOptimizer = { lastCleaned: Game.time };
  }

  // Periodic cleanup of stale paths (every 40 ticks per room)
  if (Game.time - Memory.pathOptimizer.lastCleaned > 40 && !this._cleanedUp) {
    const keys = Object.keys(Memory.pathOptimizer);
    keys.forEach(key => {
      const val = Memory.pathOptimizer![key];
      if (typeof val === "object" && val !== null && "used" in val && "tick" in val) {
        // Remove paths that are:
        // - Used less than once per 300 ticks
        // - Older than 2000 ticks
        if (val.used / (Game.time - val.tick) < 1 / 300 || Game.time - val.tick > 2000) {
          delete Memory.pathOptimizer![key];
        }
      }
    });
    this._cleanedUp = true;
    Memory.pathOptimizer.lastCleaned = Game.time;
  }

  const pathIdentifier = roomPositionIdentifier(fromPos) + roomPositionIdentifier(toPos);

  if (!Memory.pathOptimizer[pathIdentifier]) {
    // Calculate new path and cache it
    const path = originalFindPath.call(this, fromPos, toPos, opts);
    Memory.pathOptimizer[pathIdentifier] = {
      tick: Game.time,
      path: Room.serializePath(path),
      used: 1
    };
  } else {
    // Use cached path and increment usage counter
    const cachedPath = Memory.pathOptimizer[pathIdentifier];
    if (typeof cachedPath === "object" && cachedPath !== null && "used" in cachedPath) {
      cachedPath.used++;
    }
  }

  const cachedPath = Memory.pathOptimizer[pathIdentifier];
  if (typeof cachedPath === "object" && cachedPath !== null && "path" in cachedPath) {
    return Room.deserializePath(cachedPath.path);
  }

  // Fallback to original findPath if something went wrong
  return originalFindPath.call(this, fromPos, toPos, opts);
}

/**
 * Sets up path finding optimization by replacing Room.prototype.findPath
 * @returns The original findPath function for cases where uncached paths are needed
 */
export function setupPathOptimization(): typeof Room.prototype.findPath {
  originalFindPath = Room.prototype.findPath;
  Room.prototype.findPath = optimizedFindPath;
  return originalFindPath;
}

/**
 * Gets the original unoptimized findPath function
 */
export function getOriginalFindPath(): typeof Room.prototype.findPath {
  return originalFindPath;
}
