/**
 * Work-related actions for creep behavior.
 *
 * @packageDocumentation
 */

import type { CreepActionContext, CreepAction, CreepActionFactory, MoveToOptions } from "./types.js";

/**
 * Default movement options for work actions.
 */
const DEFAULT_MOVE_OPTIONS: MoveToOptions = {
  range: 3,
  reusePath: 30,
  ignoreCreeps: true
};

/**
 * Action that upgrades the room controller.
 * Moves to the controller if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * upgradeController({ creep });
 * ```
 */
export const upgradeController: CreepAction = ctx => {
  const controller = ctx.creep.room.controller;
  if (!controller) return;

  const result = ctx.creep.upgradeController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(controller, DEFAULT_MOVE_OPTIONS);
  }
};

/**
 * Action that builds a construction site.
 * Uses the target from context or finds the nearest site.
 * Moves to the site if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * buildStructure({ creep, target: constructionSite });
 * ```
 */
export const buildStructure: CreepAction = ctx => {
  let site: ConstructionSite | null = null;

  if (ctx.target instanceof ConstructionSite) {
    site = ctx.target;
  } else {
    // Find nearest construction site
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
};

/**
 * Action that repairs a structure.
 * Uses the target from context or finds a damaged structure.
 * Moves to the structure if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * repairStructure({ creep, target: damagedWall });
 * ```
 */
export const repairStructure: CreepAction = ctx => {
  let structure: Structure | null = null;

  if (ctx.target instanceof Structure) {
    structure = ctx.target;
  } else {
    // Find damaged structure
    const damaged = ctx.creep.room.find(FIND_STRUCTURES, {
      filter: (s: Structure) => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
    }) as Structure[];

    if (damaged.length > 0) {
      // Sort by damage ratio and pick the most damaged
      damaged.sort((a, b) => a.hits / a.hitsMax - b.hits / b.hitsMax);
      structure = damaged[0] ?? null;
    }
  }

  if (!structure) return;

  const result = ctx.creep.repair(structure);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(structure, { ...DEFAULT_MOVE_OPTIONS, range: 3 });
  }
};

/**
 * Creates an action that repairs structures up to a hits threshold.
 *
 * @param maxHits - Maximum hits to repair to (default: structure max)
 * @returns Action function
 *
 * @example
 * ```typescript
 * const repairWalls = repairToThreshold(10000);
 * repairWalls({ creep, target: wall });
 * ```
 */
export const repairToThreshold: CreepActionFactory<number | undefined, CreepActionContext> = maxHits => ctx => {
  if (!ctx.target || !(ctx.target instanceof Structure)) return;

  const structure = ctx.target;
  const threshold = maxHits ?? structure.hitsMax;

  // Don't repair if already at threshold
  if (structure.hits >= threshold) return;

  const result = ctx.creep.repair(structure);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(structure, { ...DEFAULT_MOVE_OPTIONS, range: 3 });
  }
};

/**
 * Action that claims a controller.
 * Moves to the controller if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * claimController({ creep });
 * ```
 */
export const claimController: CreepAction = ctx => {
  const controller = ctx.creep.room.controller;
  if (!controller) return;

  const result = ctx.creep.claimController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(controller, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
};

/**
 * Action that reserves a controller.
 * Moves to the controller if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * reserveController({ creep });
 * ```
 */
export const reserveController: CreepAction = ctx => {
  const controller = ctx.creep.room.controller;
  if (!controller) return;

  const result = ctx.creep.reserveController(controller);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(controller, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
};

/**
 * Action that signs a controller with a message.
 *
 * @param message - Message to sign with
 * @returns Action function
 *
 * @example
 * ```typescript
 * const sign = signController('Managed by screeps-gpt');
 * sign({ creep });
 * ```
 */
export const signController: CreepActionFactory<string, CreepActionContext> = message => ctx => {
  const controller = ctx.creep.room.controller;
  if (!controller) return;

  const result = ctx.creep.signController(controller, message);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(controller, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
};

/**
 * Action that attacks a hostile creep or structure.
 * Moves to the target if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * attackTarget({ creep, target: enemyCreep });
 * ```
 */
export const attackTarget: CreepAction = ctx => {
  if (!ctx.target) return;

  const result = ctx.creep.attack(ctx.target as Creep | Structure);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
};

/**
 * Action that performs a ranged attack on a target.
 * Uses ranged mass attack if target is close.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * rangedAttackTarget({ creep, target: enemyCreep });
 * ```
 */
export const rangedAttackTarget: CreepAction = ctx => {
  if (!ctx.target) return;

  const range = ctx.creep.pos.getRangeTo(ctx.target);

  if (range <= 1) {
    ctx.creep.rangedMassAttack();
  } else if (range <= 3) {
    ctx.creep.rangedAttack(ctx.target as Creep | Structure);
  } else {
    ctx.creep.moveTo(ctx.target, { ...DEFAULT_MOVE_OPTIONS, range: 3 });
  }
};

/**
 * Action that heals a creep.
 * Uses ranged heal if not adjacent.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * healTarget({ creep, target: damagedCreep });
 * ```
 */
export const healTarget: CreepAction = ctx => {
  if (!ctx.target || !(ctx.target instanceof Creep)) return;

  const range = ctx.creep.pos.getRangeTo(ctx.target);

  if (range <= 1) {
    ctx.creep.heal(ctx.target);
  } else if (range <= 3) {
    ctx.creep.rangedHeal(ctx.target);
  } else {
    ctx.creep.moveTo(ctx.target, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
};

/**
 * Action that dismantles a structure.
 * Moves to the structure if not in range.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * dismantleStructure({ creep, target: wall });
 * ```
 */
export const dismantleStructure: CreepAction = ctx => {
  if (!ctx.target || !(ctx.target instanceof Structure)) return;

  const result = ctx.creep.dismantle(ctx.target);
  if (result === ERR_NOT_IN_RANGE) {
    ctx.creep.moveTo(ctx.target, { ...DEFAULT_MOVE_OPTIONS, range: 1 });
  }
};
