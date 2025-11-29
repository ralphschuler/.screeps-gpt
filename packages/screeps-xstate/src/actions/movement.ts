/**
 * Movement-related actions for creep behavior.
 *
 * @packageDocumentation
 */

import type { CreepActionContext, CreepAction, CreepActionFactory, MoveToOptions } from "./types.js";

/**
 * Default movement options for actions.
 */
const DEFAULT_MOVE_OPTIONS: MoveToOptions = {
  range: 1,
  reusePath: 30,
  ignoreCreeps: true
};

/**
 * Creates an action that moves the creep toward its target.
 *
 * @param opts - Movement options
 * @returns Action function that moves creep toward context.target
 *
 * @example
 * ```typescript
 * const move = moveToTarget({ range: 3, reusePath: 50 });
 * move({ creep, target: controller });
 * ```
 */
export const moveToTarget: CreepActionFactory<MoveToOptions | undefined, CreepActionContext> = opts => ctx => {
  if (!ctx.target) return;
  const options = { ...DEFAULT_MOVE_OPTIONS, ...opts };
  ctx.creep.moveTo(ctx.target, options);
};

/**
 * Action that moves the creep toward its target with default options.
 * Convenience wrapper around moveToTarget.
 */
export const moveToTargetDefault: CreepAction = moveToTarget(undefined);

/**
 * Creates an action that finds the closest object by path and assigns it to context.target.
 *
 * @param findType - FIND_* constant
 * @param filter - Optional filter function
 * @returns Action function that finds and assigns closest target
 *
 * @remarks
 * If `findClosestByPath` fails to find a path (returns null), the first target
 * in the array is used as a fallback. This is intentional to handle edge cases
 * where path calculation fails but targets exist (e.g., blocked paths that may
 * open up). The caller should handle cases where movement to target fails.
 *
 * @example
 * ```typescript
 * const findSource = findClosestByPath(FIND_SOURCES_ACTIVE);
 * findSource({ creep, target: null });
 * // ctx.target is now the closest source
 * ```
 */
export function findClosestByPath(findType: FindConstant, filter?: (obj: RoomObject) => boolean): CreepAction {
  return ctx => {
    const findOpts = filter ? { filter } : undefined;
    const targets = ctx.creep.room.find(findType, findOpts);
    if (targets.length === 0) {
      ctx.target = null;
      return;
    }
    const closest = ctx.creep.pos.findClosestByPath(targets, { ignoreCreeps: true });
    // Fall back to first target if no path found - this handles edge cases
    // where paths are temporarily blocked
    ctx.target = closest ?? targets[0] ?? null;
  };
}

/**
 * Creates an action that finds the closest object in range and assigns it to context.target.
 *
 * @param findType - FIND_* constant
 * @param range - Range to search within
 * @param filter - Optional filter function
 * @returns Action function that finds and assigns closest target in range
 *
 * @example
 * ```typescript
 * const findNearbyEnemy = findInRange(FIND_HOSTILE_CREEPS, 5);
 * findNearbyEnemy({ creep, target: null });
 * ```
 */
export function findInRange(findType: FindConstant, range: number, filter?: (obj: RoomObject) => boolean): CreepAction {
  return ctx => {
    const findOpts = filter ? { filter } : undefined;
    const targets = ctx.creep.pos.findInRange(findType, range, findOpts);
    ctx.target = targets.length > 0 && targets[0] ? targets[0] : null;
  };
}

/**
 * Creates an action that moves the creep to a specific room.
 *
 * @param roomName - Name of the target room
 * @param reusePath - Path reuse ticks (default: 50)
 * @returns Action function that navigates to the room
 *
 * @example
 * ```typescript
 * const goToRemote = moveToRoom('W2N1');
 * goToRemote({ creep });
 * ```
 */
export const moveToRoom: CreepActionFactory<{ roomName: string; reusePath?: number }, CreepActionContext> =
  ({ roomName, reusePath = 50 }) =>
  ctx => {
    if (ctx.creep.room.name === roomName) {
      // Already in room, move toward center to avoid edge
      const { x, y } = ctx.creep.pos;
      if (x <= 2 || x >= 47 || y <= 2 || y >= 47) {
        ctx.creep.moveTo(new RoomPosition(25, 25, roomName), { reusePath: 0, ignoreCreeps: true });
      }
      return;
    }

    // Navigate to target room
    const exitDir = ctx.creep.room.findExitTo(roomName);
    if (exitDir !== ERR_NO_PATH && exitDir !== ERR_INVALID_ARGS) {
      const exit = ctx.creep.pos.findClosestByPath(exitDir);
      if (exit) {
        ctx.creep.moveTo(exit, { reusePath, ignoreCreeps: true });
        return;
      }
    }

    // Fallback: move directly toward room center
    ctx.creep.moveTo(new RoomPosition(25, 25, roomName), { reusePath, ignoreCreeps: true });
  };

/**
 * Action that moves the creep away from its current position toward safety.
 * Useful for fleeing from combat.
 *
 * @param ctx - Creep action context
 *
 * @example
 * ```typescript
 * flee({ creep });
 * ```
 */
export const flee: CreepAction = ctx => {
  // Find hostile creeps
  const hostiles = ctx.creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5);
  if (hostiles.length === 0) return;

  // Move away from the center of hostiles
  let avgX = 0;
  let avgY = 0;
  for (const hostile of hostiles) {
    avgX += hostile.pos.x;
    avgY += hostile.pos.y;
  }
  avgX = Math.floor(avgX / hostiles.length);
  avgY = Math.floor(avgY / hostiles.length);

  // Calculate direction away from hostiles
  const dx = ctx.creep.pos.x - avgX;
  const dy = ctx.creep.pos.y - avgY;

  // Normalize and scale
  const magnitude = Math.sqrt(dx * dx + dy * dy) || 1;
  const targetX = Math.max(1, Math.min(48, ctx.creep.pos.x + Math.round((dx / magnitude) * 5)));
  const targetY = Math.max(1, Math.min(48, ctx.creep.pos.y + Math.round((dy / magnitude) * 5)));

  ctx.creep.moveTo(new RoomPosition(targetX, targetY, ctx.creep.room.name), {
    reusePath: 0,
    ignoreCreeps: true
  });
};
