/**
 * Modular actions for screeps-xtree decision tree leaf nodes.
 *
 * This module provides reusable action functions that parallel
 * the actions in screeps-xstate. Actions are used as results
 * in decision tree leaf nodes.
 *
 * @packageDocumentation
 */

import type { CreepDecisionContext } from "./types.js";
import type { CreepConditionContext } from "./conditionTypes.js";

/**
 * Options for movement actions.
 */
export interface MoveToOptions {
  /** Range from target to stop at (default: 1) */
  range?: number;
  /** Number of ticks to reuse the path (default: 30) */
  reusePath?: number;
  /** Whether to ignore other creeps in pathfinding (default: true) */
  ignoreCreeps?: boolean;
}

/**
 * Default movement options.
 */
const DEFAULT_MOVE_OPTIONS: MoveToOptions = {
  range: 1,
  reusePath: 30,
  ignoreCreeps: true
};

// Movement actions

/**
 * Action that moves the creep toward a target.
 *
 * @param ctx - Creep context with target
 * @param opts - Movement options
 */
export function moveToTarget(ctx: CreepConditionContext, opts?: MoveToOptions): void {
  if (!ctx.target) return;
  const options = { ...DEFAULT_MOVE_OPTIONS, ...opts };
  ctx.creep.moveTo(ctx.target, options);
}

/**
 * Action that moves the creep away from hostile creeps.
 *
 * @param ctx - Creep decision context
 */
export function flee(ctx: CreepDecisionContext): void {
  const hostiles = ctx.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
  if (hostiles.length === 0) return;

  let avgX = 0;
  let avgY = 0;
  for (const hostile of hostiles) {
    avgX += hostile.pos.x;
    avgY += hostile.pos.y;
  }
  avgX = Math.floor(avgX / hostiles.length);
  avgY = Math.floor(avgY / hostiles.length);

  const dx = ctx.creep.pos.x - avgX;
  const dy = ctx.creep.pos.y - avgY;
  const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
  const targetX = Math.max(1, Math.min(48, ctx.creep.pos.x + Math.round((dx / magnitude) * 5)));
  const targetY = Math.max(1, Math.min(48, ctx.creep.pos.y + Math.round((dy / magnitude) * 5)));

  ctx.creep.moveTo(new RoomPosition(targetX, targetY, ctx.creep.room.name), {
    reusePath: 0,
    ignoreCreeps: true
  });
}

// Energy actions

/**
 * Action that harvests from the nearest active source.
 *
 * @param ctx - Creep decision context
 */
export function harvestNearestSource(ctx: CreepDecisionContext): void {
  const sources = ctx.creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
  if (sources.length === 0) return;

  const closest = ctx.creep.pos.findClosestByPath(sources, { ignoreCreeps: true });
  const source = closest ?? sources[0];
  if (!source) return;

  const result = ctx.creep.harvest(source);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(source, DEFAULT_MOVE_OPTIONS);
  }
}

/**
 * Action that harvests from a specific source in context.
 *
 * @param ctx - Creep context with sourceId
 */
export function harvestSource(ctx: CreepConditionContext): void {
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
}

/**
 * Action that transfers energy to the target.
 *
 * @param ctx - Creep context with target
 */
export function transferEnergy(ctx: CreepConditionContext): void {
  if (!ctx.target || !("store" in ctx.target)) return;

  const result = ctx.creep.transfer(ctx.target as AnyStoreStructure, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, DEFAULT_MOVE_OPTIONS);
  }
}

/**
 * Action that withdraws energy from the target.
 *
 * @param ctx - Creep context with target
 */
export function withdrawEnergy(ctx: CreepConditionContext): void {
  if (!ctx.target || !("store" in ctx.target)) return;

  const result = ctx.creep.withdraw(ctx.target as AnyStoreStructure, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, DEFAULT_MOVE_OPTIONS);
  }
}

/**
 * Action that transfers energy to spawns and extensions.
 *
 * @param ctx - Creep decision context
 */
export function transferToSpawns(ctx: CreepDecisionContext): void {
  const targets = ctx.creep.room.find(FIND_STRUCTURES, {
    filter: (s: AnyStructure) =>
      (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
      (s as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }) as AnyStoreStructure[];

  if (targets.length === 0) return;

  const closest = ctx.creep.pos.findClosestByPath(targets, { ignoreCreeps: true });
  const target = closest ?? targets[0];
  if (!target) return;

  const result = ctx.creep.transfer(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(target, DEFAULT_MOVE_OPTIONS);
  }
}

/**
 * Action that withdraws energy from containers or storage.
 *
 * @param ctx - Creep decision context
 * @param minEnergy - Minimum energy in container (default: 0)
 */
export function withdrawFromContainers(ctx: CreepDecisionContext, minEnergy = 0): void {
  const containers = ctx.creep.room.find(FIND_STRUCTURES, {
    filter: (s: AnyStructure) =>
      (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
      (s as AnyStoreStructure).store.getUsedCapacity(RESOURCE_ENERGY) > minEnergy
  }) as AnyStoreStructure[];

  if (containers.length === 0) return;

  const closest = ctx.creep.pos.findClosestByPath(containers, { ignoreCreeps: true });
  const target = closest ?? containers[0];
  if (!target) return;

  const result = ctx.creep.withdraw(target, RESOURCE_ENERGY);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(target, DEFAULT_MOVE_OPTIONS);
  }
}

// Work actions

/**
 * Action that upgrades the room controller.
 *
 * @param ctx - Creep decision context
 */
export function upgradeController(ctx: CreepDecisionContext): void {
  const controller = ctx.creep.room.controller;
  if (!controller) return;

  const result = ctx.creep.upgradeController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(controller, { ...DEFAULT_MOVE_OPTIONS, range: 3 });
  }
}

/**
 * Action that builds a construction site.
 *
 * @param ctx - Creep context with target
 */
export function buildStructure(ctx: CreepConditionContext): void {
  let site: ConstructionSite | null = null;

  if (ctx.target instanceof ConstructionSite) {
    site = ctx.target;
  } else {
    const sites = ctx.creep.room.find(FIND_MY_CONSTRUCTION_SITES) as ConstructionSite[];
    if (sites.length > 0) {
      const closest = ctx.creep.pos.findClosestByPath(sites, { ignoreCreeps: true });
      site = closest ?? sites[0] ?? null;
    }
  }

  if (!site) return;

  const result = ctx.creep.build(site);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(site, { ...DEFAULT_MOVE_OPTIONS, range: 3 });
  }
}

/**
 * Action that repairs a structure.
 *
 * @param ctx - Creep context with target
 */
export function repairStructure(ctx: CreepConditionContext): void {
  let structure: Structure | null = null;

  if (ctx.target instanceof Structure) {
    structure = ctx.target;
  } else {
    const damaged = ctx.creep.room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
    }) as Structure[];

    if (damaged.length > 0) {
      damaged.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
      structure = damaged[0] ?? null;
    }
  }

  if (!structure) return;

  const result = ctx.creep.repair(structure);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(structure, { ...DEFAULT_MOVE_OPTIONS, range: 3 });
  }
}

/**
 * Action that attacks a hostile target.
 *
 * @param ctx - Creep context with target
 */
export function attackTarget(ctx: CreepConditionContext): void {
  if (!ctx.target) return;

  const result = ctx.creep.attack(ctx.target as Creep | Structure);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
}

/**
 * Action that heals a creep.
 *
 * @param ctx - Creep context with target
 */
export function healTarget(ctx: CreepConditionContext): void {
  if (!ctx.target || !(ctx.target instanceof Creep)) return;

  const range = ctx.creep.pos.getRangeTo(ctx.target);

  if (range <= 1) {
    ctx.creep.heal(ctx.target);
  } else if (range <= 3) {
    ctx.creep.rangedHeal(ctx.target);
  } else {
    ctx.creep.moveTo(ctx.target, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
}

/**
 * Registry of all modular tree actions for easy access.
 */
export const treeActions = {
  // Movement
  moveToTarget,
  flee,

  // Energy
  harvestNearestSource,
  harvestSource,
  transferEnergy,
  withdrawEnergy,
  transferToSpawns,
  withdrawFromContainers,

  // Work
  upgradeController,
  buildStructure,
  repairStructure,
  attackTarget,
  healTarget
};
