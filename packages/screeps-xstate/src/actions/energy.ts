/**
 * Energy-related actions for creep behavior.
 *
 * @packageDocumentation
 */

import type { CreepActionContext, CreepAction, CreepActionFactory, MoveToOptions } from "./types.js";

/**
 * Default movement options for energy actions.
 */
const DEFAULT_MOVE_OPTIONS: MoveToOptions = {
  range: 1,
  reusePath: 30,
  ignoreCreeps: true
};

/**
 * Action that harvests from a source in the context.
 * Moves to the source if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * harvestSource({ creep, target: source });
 * ```
 */
export const harvestSource: CreepAction = ctx => {
  // Try to use target first, fall back to sourceId
  let source: Source | null = null;

  if (ctx.target instanceof Source) {
    source = ctx.target;
  } else if (ctx.sourceId) {
    source = Game.getObjectById(ctx.sourceId);
  }

  if (!source) return;

  const result = ctx.creep.harvest(source);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(source, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Action that harvests from the nearest active source.
 * Finds the source and moves to it if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * harvestNearestSource({ creep });
 * ```
 */
export const harvestNearestSource: CreepAction = ctx => {
  const sources = ctx.creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
  if (sources.length === 0) return;

  const closest = ctx.creep.pos.findClosestByPath(sources, { ignoreCreeps: true });
  // Fall back to first source if no path found - handles temporarily blocked paths
  const source = closest ?? sources[0] ?? null;
  if (!source) return;

  const result = ctx.creep.harvest(source);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(source, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Action that transfers energy to the target.
 * Moves to the target if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * transferEnergy({ creep, target: spawn });
 * ```
 */
export const transferEnergy: CreepAction = ctx => {
  if (!ctx.target || !("store" in ctx.target)) return;

  const result = ctx.creep.transfer(ctx.target as AnyStoreStructure, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Action that withdraws energy from the target.
 * Moves to the target if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * withdrawEnergy({ creep, target: container });
 * ```
 */
export const withdrawEnergy: CreepAction = ctx => {
  if (!ctx.target || !("store" in ctx.target)) return;

  const result = ctx.creep.withdraw(ctx.target as AnyStoreStructure, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Action that picks up dropped energy.
 * Moves to the resource if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * pickupEnergy({ creep, target: droppedResource });
 * ```
 */
export const pickupEnergy: CreepAction = ctx => {
  if (!ctx.target || !(ctx.target instanceof Resource)) return;

  const result = ctx.creep.pickup(ctx.target);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Action that picks up the nearest dropped energy.
 * Finds dropped energy and picks it up or moves to it.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * pickupNearestEnergy({ creep });
 * ```
 */
export const pickupNearestEnergy: CreepAction = ctx => {
  const dropped = ctx.creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: r => r.resourceType === RESOURCE_ENERGY && r.amount >= 50
  }) as Resource[];

  if (dropped.length === 0) return;

  const closest = ctx.creep.pos.findClosestByPath(dropped, { ignoreCreeps: true });
  // Fall back to first resource if no path found
  const target = closest ?? dropped[0] ?? null;
  if (!target) return;

  const result = ctx.creep.pickup(target);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(target, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Creates an action that transfers energy to spawns and extensions.
 * Finds the nearest spawn/extension needing energy and transfers.
 *
 * @param opts - Movement options
 * @returns Action function
 *
 * @example
 * ```typescript
 * const deliverToSpawn = transferToSpawns();
 * deliverToSpawn({ creep });
 * ```
 */
export const transferToSpawns: CreepActionFactory<MoveToOptions | undefined, CreepActionContext> = opts => ctx => {
  const options = { ...DEFAULT_MOVE_OPTIONS, ...opts };

  const targets = ctx.creep.room.find(FIND_STRUCTURES, {
    filter: (s: AnyStructure) =>
      (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
      (s as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  if (targets.length === 0) return;

  const closest = ctx.creep.pos.findClosestByPath(targets, { ignoreCreeps: true });
  // Fall back to first target if no path found
  const target = closest ?? targets[0] ?? null;
  if (!target) return;

  const result = ctx.creep.transfer(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(target, options);
  }
};

/**
 * Creates an action that withdraws energy from containers or storage.
 * Finds valid energy sources and withdraws.
 *
 * @param minEnergy - Minimum energy in container (default: 0)
 * @returns Action function
 *
 * @example
 * ```typescript
 * const getEnergy = withdrawFromContainers(100);
 * getEnergy({ creep });
 * ```
 */
export const withdrawFromContainers: CreepActionFactory<number | undefined, CreepActionContext> =
  (minEnergy = 0) =>
  ctx => {
    const containers = ctx.creep.room.find(FIND_STRUCTURES, {
      filter: (s: AnyStructure) =>
        (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
        (s as AnyStoreStructure).store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy
    }) as AnyStoreStructure[];

    if (containers.length === 0) return;

    const closest = ctx.creep.pos.findClosestByPath(containers, { ignoreCreeps: true });
    // Fall back to first container if no path found
    const target = closest ?? containers[0] ?? null;
    if (!target) return;

    const result = ctx.creep.withdraw(target, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      ctx.creep.moveTo(target, DEFAULT_MOVE_OPTIONS);
    }
  };
