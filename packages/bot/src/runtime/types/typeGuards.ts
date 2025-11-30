/**
 * Type Guards and Runtime Validation Helpers
 *
 * This module provides type guard functions and validation helpers to replace
 * unsafe type assertions (`as Creep`, `as Source[]`, etc.) with safer alternatives.
 *
 * The type guards:
 * - Provide runtime validation instead of compile-time-only assertions
 * - Enable proper TypeScript type narrowing
 * - Improve error handling when objects don't match expected types
 *
 * @module runtime/types/typeGuards
 * @see Issue #1565 - Reduce unsafe type assertions
 */

import type { CreepLike, RoomLike, SpawnLike } from "./GameContext";

// =============================================================================
// Creep Type Guards
// =============================================================================

/**
 * Type guard to check if an object is a Creep with all required properties.
 * This validates the object at runtime before allowing Creep-specific operations.
 *
 * Note: This is a lenient check to support test mocks that may not implement
 * all Creep methods. It verifies core structural properties exist.
 *
 * @param obj - Object to validate
 * @returns true if the object has Creep-like structure
 */
export function isCreep(obj: unknown): obj is Creep {
  return obj !== null && typeof obj === "object" && "name" in obj && "memory" in obj && "room" in obj;
}

/**
 * Type guard to check if a CreepLike is actually a full Creep.
 * Useful when you have a CreepLike but need to ensure it has full Creep API.
 *
 * Checks for multiple Creep-specific methods that aren't in CreepLike to reduce
 * false positives.
 *
 * @param creep - CreepLike object to validate
 * @returns true if the object is a full Creep
 */
export function isFullCreep(creep: CreepLike): creep is Creep {
  // Check for multiple Creep-specific methods not in CreepLike
  // All of these methods exist on Creep but not on CreepLike
  return "attack" in creep && "rangedAttack" in creep && "heal" in creep && "claimController" in creep;
}

/**
 * Validates and returns a Creep from a CreepLike.
 * Throws if the object is not a valid Creep.
 *
 * Use this when you need to pass a CreepLike to an API that requires Creep,
 * but want runtime validation instead of just `as Creep`.
 *
 * @param creep - CreepLike to validate
 * @param context - Optional context string for error messages
 * @returns The same object typed as Creep
 * @throws TypeError if the object is not a valid Creep
 */
export function asCreep(creep: CreepLike, context?: string): Creep {
  if (!isCreep(creep)) {
    const prefix = context ? `[${context}] ` : "";
    throw new TypeError(`${prefix}Invalid Creep object: missing required properties (name, memory, room)`);
  }
  return creep;
}

// =============================================================================
// Source Type Guards
// =============================================================================

/**
 * Type guard to check if an object is a Source.
 *
 * @param obj - Object to validate
 * @returns true if the object is a Source
 */
export function isSource(obj: unknown): obj is Source {
  return (
    obj !== null &&
    typeof obj === "object" &&
    "id" in obj &&
    "energy" in obj &&
    "energyCapacity" in obj &&
    "ticksToRegeneration" in obj &&
    "pos" in obj
  );
}

// =============================================================================
// Structure Type Guards
// =============================================================================

/**
 * Type guard to check if an object is a Structure.
 *
 * @param obj - Object to validate
 * @returns true if the object is a Structure
 */
export function isStructure(obj: unknown): obj is Structure {
  return obj !== null && typeof obj === "object" && "id" in obj && "structureType" in obj && "pos" in obj;
}

/**
 * Type guard to check if a structure is a StructureSpawn.
 *
 * @param structure - Structure to check
 * @returns true if the structure is a spawn
 */
export function isSpawn(structure: Structure): structure is StructureSpawn {
  return structure.structureType === STRUCTURE_SPAWN;
}

/**
 * Type guard to check if a structure is a StructureContainer.
 *
 * @param structure - Structure to check
 * @returns true if the structure is a container
 */
export function isContainer(structure: Structure): structure is StructureContainer {
  return structure.structureType === STRUCTURE_CONTAINER;
}

/**
 * Type guard to check if a structure is a StructureTower.
 *
 * @param structure - Structure to check
 * @returns true if the structure is a tower
 */
export function isTower(structure: Structure): structure is StructureTower {
  return structure.structureType === STRUCTURE_TOWER;
}

/**
 * Type guard to check if a structure is a StructureStorage.
 *
 * @param structure - Structure to check
 * @returns true if the structure is a storage
 */
export function isStorage(structure: Structure): structure is StructureStorage {
  return structure.structureType === STRUCTURE_STORAGE;
}

/**
 * Type guard to check if a structure is a StructureExtension.
 *
 * @param structure - Structure to check
 * @returns true if the structure is an extension
 */
export function isExtension(structure: Structure): structure is StructureExtension {
  return structure.structureType === STRUCTURE_EXTENSION;
}

/**
 * Type guard to check if a structure is a StructureLink.
 *
 * @param structure - Structure to check
 * @returns true if the structure is a link
 */
export function isLink(structure: Structure): structure is StructureLink {
  return structure.structureType === STRUCTURE_LINK;
}

/**
 * Type guard to check if a structure has a store (is AnyStoreStructure).
 * This is useful when you need to access store methods on a structure.
 *
 * @param structure - Structure to check
 * @returns true if the structure has a store
 */
export function hasStore(structure: Structure): structure is AnyStoreStructure {
  return "store" in structure;
}

// =============================================================================
// Room.find() Type-Safe Helpers
// =============================================================================
//
// NOTE: These wrappers still use type assertions (`as`) internally because
// the Screeps `room.find()` API returns `unknown[]` but the return types are
// guaranteed by the Screeps engine based on the find constant used.
//
// These wrappers centralize type assertions in one place rather than scattering
// `as Source[]`, `as Creep[]` throughout controller code, making it easier to:
// - Update if the Screeps API changes
// - Add runtime validation if needed in the future
// - Search for and audit all type assertions
//
// The assertions are considered safe because:
// 1. Screeps API guarantees specific return types for each FIND_* constant
// 2. The find constants are compile-time constants that match the type
// =============================================================================

/**
 * Type-safe wrapper for room.find(FIND_SOURCES_ACTIVE).
 * Returns a typed array of active Source objects.
 *
 * Note: Uses type assertion internally as Screeps guarantees return type for FIND_SOURCES_ACTIVE.
 *
 * @param room - Room to search
 * @returns Array of active sources in the room
 */
export function findActiveSources(room: RoomLike): Source[] {
  return room.find(FIND_SOURCES_ACTIVE) as Source[];
}

/**
 * Type-safe wrapper for room.find(FIND_SOURCES).
 * Returns a typed array of all Source objects.
 *
 * Note: Uses type assertion internally as Screeps guarantees return type for FIND_SOURCES.
 *
 * @param room - Room to search
 * @returns Array of all sources in the room
 */
export function findAllSources(room: RoomLike): Source[] {
  return room.find(FIND_SOURCES) as Source[];
}

/**
 * Type-safe wrapper for room.find(FIND_MY_SPAWNS).
 * Returns a typed array of owned spawn structures.
 *
 * Note: Uses type assertion internally as Screeps guarantees return type for FIND_MY_SPAWNS.
 *
 * @param room - Room to search
 * @returns Array of owned spawns in the room
 */
export function findMySpawns(room: RoomLike): StructureSpawn[] {
  return room.find(FIND_MY_SPAWNS) as StructureSpawn[];
}

/**
 * Type-safe wrapper for room.find(FIND_HOSTILE_CREEPS).
 * Returns a typed array of hostile creeps.
 *
 * @param room - Room to search
 * @returns Array of hostile creeps in the room
 */
export function findHostileCreeps(room: RoomLike): Creep[] {
  return room.find(FIND_HOSTILE_CREEPS) as Creep[];
}

/**
 * Type-safe wrapper for room.find(FIND_MY_CREEPS).
 * Returns a typed array of owned creeps.
 *
 * @param room - Room to search
 * @returns Array of owned creeps in the room
 */
export function findMyCreeps(room: RoomLike): Creep[] {
  return room.find(FIND_MY_CREEPS) as Creep[];
}

/**
 * Type-safe wrapper for room.find(FIND_DROPPED_RESOURCES).
 * Returns a typed array of dropped resources.
 *
 * @param room - Room to search
 * @param filter - Optional filter function
 * @returns Array of dropped resources in the room
 */
export function findDroppedResources(room: RoomLike, filter?: (resource: Resource) => boolean): Resource[] {
  const opts = filter ? { filter: filter as (obj: unknown) => boolean } : undefined;
  return room.find(FIND_DROPPED_RESOURCES, opts) as Resource[];
}

/**
 * Type-safe helper to find structures of a specific type.
 *
 * @param room - Room to search
 * @param structureType - The structure type constant
 * @param filter - Optional additional filter
 * @returns Array of structures matching the type
 */
export function findStructuresByType<T extends AnyStructure>(
  room: RoomLike,
  structureType: StructureConstant,
  filter?: (structure: T) => boolean
): T[] {
  const baseFilter = (s: unknown): boolean => {
    const structure = s as AnyStructure;
    if (structure.structureType !== structureType) return false;
    if (filter) return filter(structure as T);
    return true;
  };
  return room.find(FIND_STRUCTURES, { filter: baseFilter }) as T[];
}

/**
 * Type-safe helper to find containers in a room.
 *
 * @param room - Room to search
 * @param filter - Optional filter function
 * @returns Array of containers in the room
 */
export function findContainers(
  room: RoomLike,
  filter?: (container: StructureContainer) => boolean
): StructureContainer[] {
  return findStructuresByType<StructureContainer>(room, STRUCTURE_CONTAINER, filter);
}

/**
 * Type-safe helper to find towers in a room.
 *
 * @param room - Room to search
 * @param filter - Optional filter function
 * @returns Array of towers in the room
 */
export function findTowers(room: RoomLike, filter?: (tower: StructureTower) => boolean): StructureTower[] {
  return findStructuresByType<StructureTower>(room, STRUCTURE_TOWER, filter);
}

/**
 * Type-safe helper to find spawns and extensions that need energy.
 *
 * @param room - Room to search
 * @returns Array of spawns and extensions with free energy capacity
 */
export function findEnergyReceivers(room: RoomLike): AnyStoreStructure[] {
  return room.find(FIND_STRUCTURES, {
    filter: (structure: unknown) => {
      const s = structure as AnyStructure;
      return (
        (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
        hasStore(s) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      );
    }
  }) as AnyStoreStructure[];
}

// =============================================================================
// Spawn/Room Type Guards
// =============================================================================

/**
 * Type guard to check if an object is a SpawnLike.
 *
 * @param obj - Object to validate
 * @returns true if the object has SpawnLike structure
 */
export function isSpawnLike(obj: unknown): obj is SpawnLike {
  return (
    obj !== null && typeof obj === "object" && "name" in obj && "spawnCreep" in obj && "store" in obj && "room" in obj
  );
}

/**
 * Type guard to check if a RoomLike is actually a full Room.
 *
 * @param room - RoomLike to validate
 * @returns true if the object is a full Room
 */
export function isFullRoom(room: RoomLike): room is Room {
  // Check for Room-specific methods not in RoomLike
  return "visual" in room && "lookAt" in room;
}

/**
 * Safely gets a Room from a RoomLike.
 * Returns undefined if the conversion is not safe.
 *
 * @param room - RoomLike to convert
 * @returns Room if it's a full room, undefined otherwise
 */
export function asRoom(room: RoomLike): Room | undefined {
  return isFullRoom(room) ? room : undefined;
}

// =============================================================================
// Utility Validation Helpers
// =============================================================================

/**
 * Validates that an ID corresponds to a valid game object.
 * Wraps Game.getObjectById with type safety.
 *
 * @param id - The object ID to look up
 * @returns The object if found, or null
 */
export function getValidObject<T extends _HasId>(id: Id<T> | undefined): T | null {
  if (!id) return null;
  return Game.getObjectById(id);
}

/**
 * Helper interface for objects with IDs
 */
interface _HasId {
  id: Id<this>;
}
