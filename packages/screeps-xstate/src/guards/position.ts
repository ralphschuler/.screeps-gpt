/**
 * Position-related guards for creep behavior.
 *
 * @packageDocumentation
 */

import type { CreepContext, CreepGuard, CreepGuardFactory } from "./types.js";

/**
 * Creates a guard that checks if the creep is within range of its target.
 *
 * @param range - Maximum distance to target (default: 1)
 * @returns Guard function that returns true if creep is within range of target
 *
 * @example
 * ```typescript
 * const nearTarget = isNearTarget(3);
 * if (nearTarget({ creep, target: source })) {
 *   // Creep is within 3 tiles of target
 * }
 * ```
 */
export const isNearTarget: CreepGuardFactory<number | undefined, CreepContext> =
  (range = 1) =>
  ctx => {
    if (!ctx.target) return false;
    const targetPos = "pos" in ctx.target ? ctx.target.pos : ctx.target;
    return ctx.creep.pos.getRangeTo(targetPos) <= range;
  };

/**
 * Guard that checks if the creep is at the exact position of its target.
 *
 * @param ctx - Creep context
 * @returns true if creep is at the same position as target
 *
 * @example
 * ```typescript
 * if (isAtTarget({ creep, target: flag })) {
 *   // Creep is standing on the flag position
 * }
 * ```
 */
export const isAtTarget: CreepGuard = ctx => {
  if (!ctx.target) return false;
  const targetPos = "pos" in ctx.target ? ctx.target.pos : ctx.target;
  return ctx.creep.pos.isEqualTo(targetPos);
};

/**
 * Guard that checks if the creep has a target assigned.
 *
 * @param ctx - Creep context
 * @returns true if target is defined and not null
 *
 * @example
 * ```typescript
 * if (hasTarget({ creep, target })) {
 *   // Creep has a valid target
 * }
 * ```
 */
export const hasTarget: CreepGuard = ctx => ctx.target != null;

/**
 * Creates a guard that checks if the creep is in a specific room.
 *
 * @param roomName - Name of the room to check
 * @returns Guard function that returns true if creep is in the specified room
 *
 * @example
 * ```typescript
 * const inHomeRoom = isInRoom('W1N1');
 * if (inHomeRoom({ creep })) {
 *   // Creep is in room W1N1
 * }
 * ```
 */
export const isInRoom: CreepGuardFactory<string, CreepContext> = roomName => ctx =>
  ctx.creep.room.name === roomName;

/**
 * Guard that checks if the creep is near a room exit (within 2 tiles of edge).
 *
 * @param ctx - Creep context
 * @returns true if creep is within 2 tiles of a room edge
 *
 * @example
 * ```typescript
 * if (isNearExit({ creep })) {
 *   // Creep is close to room edge
 * }
 * ```
 */
export const isNearExit: CreepGuard = ctx => {
  const { x, y } = ctx.creep.pos;
  return x <= 2 || x >= 47 || y <= 2 || y >= 47;
};

/**
 * Guard that checks if the creep is at a room exit (at edge tile).
 *
 * @param ctx - Creep context
 * @returns true if creep is at a room edge tile
 *
 * @example
 * ```typescript
 * if (isAtExit({ creep })) {
 *   // Creep is at room edge
 * }
 * ```
 */
export const isAtExit: CreepGuard = ctx => {
  const { x, y } = ctx.creep.pos;
  return x === 0 || x === 49 || y === 0 || y === 49;
};
