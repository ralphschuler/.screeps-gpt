/**
 * Shared helper utilities for role controllers
 */

import type { CreepLike } from "@runtime/types/GameContext";
import {
  asCreep,
  findMySpawns,
  findAllSources,
  findTowers,
  findDroppedResources
} from "@runtime/types/typeGuards";
import { serviceRegistry } from "./ServiceLocator";

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
 * Movement priority constants for traffic management.
 * Higher priority creeps move first and can push lower priority creeps out of the way.
 *
 * @see https://github.com/NesCafe62/screeps-pathfinding for traffic management details
 */
export const MOVEMENT_PRIORITY = {
  /** Stationary harvesters at source positions - highest priority */
  STATIONARY_HARVESTER: 6,
  /** Miners and mobile harvesters - critical for energy collection */
  HARVESTER: 5,
  /** Haulers - logistics backbone */
  HAULER: 4,
  /** Combat roles - need to move quickly for defense */
  COMBAT: 3,
  /** Builders and repairers - infrastructure support */
  BUILDER: 2,
  /** Scouts and claimers */
  SUPPORT: 1,
  /** Upgraders - lowest priority, can wait */
  UPGRADER: 0
} as const;

export type MovementPriorityLevel = (typeof MOVEMENT_PRIORITY)[keyof typeof MOVEMENT_PRIORITY];

/**
 * Options for findClosestOrFirst helper function
 */
export interface FindClosestOptions {
  /**
   * Whether to ignore creeps when pathfinding.
   * Set to true for better routing through narrow passages where only one creep fits.
   * When not specified, defaults to true in the function implementation.
   */
  ignoreCreeps?: boolean;
}

/**
 * Helper function to find the closest target by path or fall back to the first target.
 * Reduces code duplication throughout role controllers.
 *
 * By default, ignores other creeps when calculating paths to properly handle
 * narrow passages where only one creep can fit through. This prevents creeps
 * from getting stuck or choosing suboptimal paths due to temporary blockages.
 *
 * @param creep - The creep to find a path from
 * @param targets - Array of potential targets
 * @param options - Optional pathfinding options
 * @returns The closest target by path, or the first target if pathfinding fails, or null if no targets
 */
export function findClosestOrFirst<T extends _HasRoomPosition>(
  creep: CreepLike,
  targets: T[],
  options: FindClosestOptions = {}
): T | null {
  if (targets.length === 0) {
    return null;
  }
  // Default to ignoring creeps for better narrow passage handling
  const ignoreCreeps = options.ignoreCreeps ?? true;
  return creep.pos.findClosestByPath(targets, { ignoreCreeps }) ?? targets[0];
}

/**
 * Helper function to pick up nearby dropped energy if the creep has capacity.
 * Returns true if the creep picked up or is moving to pick up energy.
 *
 * Uses amount-based prioritization: prioritizes larger energy piles first,
 * with distance as a tiebreaker for piles of similar size.
 *
 * @param creep - The creep that should pick up energy
 * @param minAmount - Minimum amount of energy to consider picking up (default: 50)
 * @param priorityAmount - Energy amount threshold above which piles are prioritized (default: 100)
 * @param amountTiebreakerThreshold - Amount difference threshold for using distance as tiebreaker (default: 50)
 * @returns true if energy pickup is in progress, false otherwise
 */
export function tryPickupDroppedEnergy(
  creep: CreepLike,
  minAmount = 50,
  priorityAmount = 100,
  amountTiebreakerThreshold = 50
): boolean {
  // Only pick up if creep has capacity
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    return false;
  }

  const droppedEnergy = findDroppedResources(
    creep.room,
    r => r.resourceType === RESOURCE_ENERGY && r.amount >= minAmount
  );

  if (droppedEnergy.length === 0) {
    return false;
  }

  // Sort by energy amount (highest first), with distance as tiebreaker
  const sorted = droppedEnergy.sort((a, b) => {
    // Prioritize piles above the priority threshold
    const aAboveThreshold = a.amount >= priorityAmount;
    const bAboveThreshold = b.amount >= priorityAmount;

    if (aAboveThreshold && !bAboveThreshold) return -1;
    if (bAboveThreshold && !aAboveThreshold) return 1;

    // For similar amounts (within threshold), use distance as tiebreaker
    if (Math.abs(a.amount - b.amount) < amountTiebreakerThreshold) {
      const distA = creep.pos.getRangeTo(a);
      const distB = creep.pos.getRangeTo(b);
      return distA - distB;
    }

    // Otherwise prefer higher amounts
    return b.amount - a.amount;
  });

  const target = sorted[0];

  const result = creep.pickup(target);
  if (result === ERR_NOT_IN_RANGE) {
    // Use ignoreCreeps for better routing through narrow passages
    creep.moveTo(target, { range: 1, reusePath: 10, ignoreCreeps: true });
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
  const spawns = findMySpawns(room as Parameters<typeof findMySpawns>[0]);
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
  return findTowers(
    room as Parameters<typeof findTowers>[0],
    tower => {
      const capacity = tower.store.getCapacity(RESOURCE_ENERGY);
      const used = tower.store.getUsedCapacity(RESOURCE_ENERGY);
      return used < capacity * minCapacityRatio;
    }
  );
}

/**
 * Check if a source has an adjacent container.
 * Used to determine if stationary harvester infrastructure is in place.
 *
 * @param source - The source to check
 * @returns true if there is at least one container within range 1 of the source
 */
export function hasSourceContainer(source: Source): boolean {
  const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
  });
  return containers.length > 0;
}

/**
 * Get a container adjacent to a source.
 * Used to find where stationary harvesters deposit energy.
 *
 * @param source - The source to find a container for
 * @returns The first container within range 1 of the source, or null if none exists
 */
export function getSourceContainer(source: Source): StructureContainer | null {
  const containers = source.pos.findInRange<FIND_STRUCTURES, StructureContainer>(FIND_STRUCTURES, 1, {
    filter: (s: Structure) => s.structureType === STRUCTURE_CONTAINER
  });
  return containers[0] ?? null;
}

/**
 * Finds containers adjacent to sources in a room that have free capacity.
 * Used by harvesters to deposit energy near sources for hauler pickup.
 *
 * @param room - The room to search in
 * @returns Array of containers adjacent to sources with free capacity
 */
export function findSourceAdjacentContainers(room: {
  find: (constant: number, opts?: unknown) => unknown[];
}): StructureContainer[] {
  const sources = findAllSources(room as Parameters<typeof findAllSources>[0]);
  const containerSet = new Set<string>(); // Track unique container IDs
  const containers: StructureContainer[] = [];

  for (const source of sources) {
    const nearbyContainers = source.pos.findInRange<FIND_STRUCTURES, StructureContainer>(FIND_STRUCTURES, 1, {
      filter: (s: Structure) =>
        s.structureType === STRUCTURE_CONTAINER && (s as StructureContainer).store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    for (const container of nearbyContainers) {
      // Avoid duplicates if container is adjacent to multiple sources
      if (!containerSet.has(container.id)) {
        containerSet.add(container.id);
        containers.push(container);
      }
    }
  }

  return containers;
}

/** Threshold for detecting creeps near room exit (tiles from edge) */
const NEAR_EXIT_THRESHOLD = 2;
/** Upper bound for near-exit detection (ROOM_MAX - threshold) */
const NEAR_EXIT_UPPER = 49 - NEAR_EXIT_THRESHOLD;

/**
 * Helper function to move a creep to a target room.
 * Handles finding exit direction and navigating to room exits.
 * When at or near room edge, moves toward target room center with fresh pathfinding
 * to avoid oscillation, cached path issues, and ensure proper boundary crossing.
 *
 * Uses ignoreCreeps: true for better routing through narrow passages.
 *
 * @param creep - The creep to move
 * @param targetRoom - Target room name
 * @param reusePath - Path reuse parameter
 * @returns true if the creep is still moving (not yet safely in target room interior), false if done
 */
export function moveToTargetRoom(creep: CreepLike, targetRoom: string, reusePath: number = 50): boolean {
  const { x, y } = creep.pos;

  // Check if creep is at or near room edge
  // At edge: coordinates 0 or 49 (room boundary)
  // Near exit: within NEAR_EXIT_THRESHOLD tiles of edge
  const atEdge = x === 0 || x === 49 || y === 0 || y === 49;
  const nearExit = x <= NEAR_EXIT_THRESHOLD || x >= NEAR_EXIT_UPPER || y <= NEAR_EXIT_THRESHOLD || y >= NEAR_EXIT_UPPER;

  if (creep.room.name === targetRoom) {
    // In target room but at/near edge - move toward center to avoid cycling back through exit
    if (atEdge || nearExit) {
      creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, targetRoom), { reusePath: 0, ignoreCreeps: true });
      return true;
    }
    return false;
  }

  // Not in target room - need to navigate there
  // When at edge or near exit, use fresh pathfinding toward target room center
  // This prevents cached path issues and ensures proper room boundary crossing
  if (atEdge || nearExit) {
    creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, targetRoom), { reusePath: 0, ignoreCreeps: true });
    return true;
  }

  // Far from exit - use exit-based navigation for efficiency
  // First try direct exit to target (for adjacent rooms)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  let exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(targetRoom);

  // If findExitTo fails (non-adjacent room), use Game.map.findRoute to find the path
  if (exitDir === ERR_NO_PATH || exitDir === ERR_INVALID_ARGS) {
    const route = Game.map.findRoute(creep.room.name, targetRoom);
    if (route !== ERR_NO_PATH && Array.isArray(route) && route.length > 0) {
      // Get the exit direction to the first room in the route
      exitDir = route[0].exit;
    } else {
      // No valid route found - move directly toward target room center as fallback
      creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, targetRoom), { reusePath, ignoreCreeps: true });
      return true;
    }
  }

  // Use exit-based navigation when we have a valid exit direction
  if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
    const exitPositions = creep.room.find(exitDir) as RoomPosition[];
    if (exitPositions.length > 0) {
      const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions, { ignoreCreeps: true });
      const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
      creep.moveTo(actualExitPos, { reusePath, ignoreCreeps: true });
      return true;
    }
  }

  // Fallback: move directly toward target room center
  creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, targetRoom), { reusePath, ignoreCreeps: true });
  return true;
}

/**
 * Options for priority-aware movement using screeps-pathfinding
 */
export interface PriorityMoveOptions {
  /** Range from target to stop at (default: 1) */
  range?: number;
  /** Path reuse ticks (default: 30) */
  reusePath?: number;
  /** Whether to ignore other creeps in pathfinding (default: true) */
  ignoreCreeps?: boolean;
  /** Movement priority for traffic management (default: 0) */
  priority?: MovementPriorityLevel;
  /** Whether to move off road when finished (default: false) */
  moveOffRoad?: boolean;
  /** Visualize path style (optional) */
  visualizePathStyle?: PolyStyle;
}

/**
 * Priority-aware movement helper using screeps-pathfinding library.
 * Uses PathfindingManager from ServiceLocator for traffic management.
 *
 * When PathfindingManager is available, this enables:
 * - Priority-based movement (higher priority creeps move first)
 * - Traffic management (push or swap with lower priority creeps)
 * - Move off road behavior when finished working
 *
 * Falls back to native creep.moveTo() when PathfindingManager is not available.
 *
 * @param creep - The creep to move
 * @param target - Target position or object with pos property
 * @param options - Movement options including priority
 * @returns ScreepsReturnCode from moveTo operation
 */
export function priorityMoveTo(
  creep: CreepLike,
  target: RoomPosition | { pos: RoomPosition },
  options: PriorityMoveOptions = {}
): ScreepsReturnCode {
  const pathfindingManager = serviceRegistry.getPathfindingManager();

  // Validate and clamp priority to valid range (0-6)
  const rawPriority = options.priority ?? MOVEMENT_PRIORITY.UPGRADER;
  const priority = Math.max(0, Math.min(6, rawPriority));

  const opts = {
    range: options.range ?? 1,
    reusePath: options.reusePath ?? 30,
    ignoreCreeps: options.ignoreCreeps ?? true,
    priority,
    moveOffRoad: options.moveOffRoad ?? false,
    visualizePathStyle: options.visualizePathStyle
  };

  // Use PathfindingManager for traffic-managed movement when available
  if (pathfindingManager?.isAvailable()) {
    return pathfindingManager.moveTo(asCreep(creep, "priorityMoveTo"), target, opts);
  }

  // Fallback to native moveTo when PathfindingManager is not available
  return creep.moveTo(target, {
    range: opts.range,
    reusePath: opts.reusePath,
    ignoreCreeps: opts.ignoreCreeps,
    visualizePathStyle: opts.visualizePathStyle
  });
}
