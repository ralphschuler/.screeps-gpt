/**
 * Shared test mock factories for BasePlanner tests
 *
 * These helper functions provide consistent mock objects for RoomTerrain
 * and Room structures used across multiple test files.
 */

import type { RoomLike } from "../../src/runtime/types/GameContext";

// Screeps constants for testing
const TERRAIN_MASK_WALL = 1;
const FIND_MY_SPAWNS = 104;
const FIND_STRUCTURES = 107;
const FIND_MY_CONSTRUCTION_SITES = 114;
const STRUCTURE_SPAWN = "spawn" as BuildableStructureConstant;

/**
 * Creates a mock RoomTerrain with walls only at room edges (x/y = 0 or 49)
 */
export function createMockTerrain(): RoomTerrain {
  return {
    get: (x: number, y: number) => {
      if (x === 0 || y === 0 || x === 49 || y === 49) {
        return TERRAIN_MASK_WALL;
      }
      return 0;
    },
    getRawBuffer: () => new Uint8Array(2500)
  } as RoomTerrain;
}

/**
 * Creates a mock RoomTerrain with additional walls for testing placement logic
 * Includes a wall at (26, 25) adjacent to the default spawn position
 */
export function createMockTerrainWithWalls(): RoomTerrain {
  return {
    get: (x: number, y: number) => {
      if (x === 0 || y === 0 || x === 49 || y === 49) {
        return TERRAIN_MASK_WALL;
      }
      if (x === 26 && y === 25) {
        return TERRAIN_MASK_WALL;
      }
      return 0;
    },
    getRawBuffer: () => new Uint8Array(2500)
  } as RoomTerrain;
}

/**
 * Creates a mock Room object for testing BasePlanner
 * @param rcl - The Room Controller Level (1-8)
 * @param spawnPos - Optional spawn position, defaults to {x: 25, y: 25}
 * @param roomName - Optional room name, defaults to "W1N1"
 */
export function createMockRoom(
  rcl: number,
  spawnPos: { x: number; y: number } = { x: 25, y: 25 },
  roomName: string = "W1N1"
): RoomLike {
  return {
    name: roomName,
    controller: {
      my: true,
      level: rcl,
      pos: { x: spawnPos.x, y: spawnPos.y }
    },
    find: (findConstant: FindConstant) => {
      if (findConstant === FIND_MY_SPAWNS) {
        return [
          {
            pos: { x: spawnPos.x, y: spawnPos.y },
            name: "Spawn1",
            structureType: STRUCTURE_SPAWN
          }
        ];
      }
      if (findConstant === FIND_STRUCTURES) {
        return [
          {
            pos: { x: spawnPos.x, y: spawnPos.y },
            structureType: STRUCTURE_SPAWN
          }
        ];
      }
      if (findConstant === FIND_MY_CONSTRUCTION_SITES) {
        return [];
      }
      return [];
    },
    getTerrain: () => createMockTerrain()
  } as unknown as RoomLike;
}

// Re-export constants for convenience
export const TEST_CONSTANTS = {
  TERRAIN_MASK_WALL,
  FIND_MY_SPAWNS,
  FIND_STRUCTURES,
  FIND_MY_CONSTRUCTION_SITES,
  STRUCTURE_SPAWN
};
