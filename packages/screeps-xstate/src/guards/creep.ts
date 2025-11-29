/**
 * Creep-related guards for behavior validation.
 *
 * @packageDocumentation
 */

import type { CreepContext, CreepGuard, CreepGuardFactory } from "./types.js";

/**
 * Creates a guard that checks if the creep has a specific body part.
 *
 * @param part - Body part constant to check for
 * @returns Guard function that returns true if creep has the body part
 *
 * @example
 * ```typescript
 * const canWork = hasBodyPart(WORK);
 * if (canWork({ creep })) {
 *   // Creep has WORK parts
 * }
 * ```
 */
export const hasBodyPart: CreepGuardFactory<BodyPartConstant, CreepContext> = part => ctx =>
  ctx.creep.body.some(p => p.type === part);

/**
 * Guard that checks if the creep has WORK body parts.
 * Pre-configured convenience guard.
 */
export const hasWorkParts: CreepGuard = hasBodyPart(WORK);

/**
 * Guard that checks if the creep has CARRY body parts.
 * Pre-configured convenience guard.
 */
export const hasCarryParts: CreepGuard = hasBodyPart(CARRY);

/**
 * Guard that checks if the creep has MOVE body parts.
 * Pre-configured convenience guard.
 */
export const hasMoveParts: CreepGuard = hasBodyPart(MOVE);

/**
 * Guard that checks if the creep has ATTACK body parts.
 * Pre-configured convenience guard.
 */
export const hasAttackParts: CreepGuard = hasBodyPart(ATTACK);

/**
 * Guard that checks if the creep has RANGED_ATTACK body parts.
 * Pre-configured convenience guard.
 */
export const hasRangedAttackParts: CreepGuard = hasBodyPart(RANGED_ATTACK);

/**
 * Guard that checks if the creep has HEAL body parts.
 * Pre-configured convenience guard.
 */
export const hasHealParts: CreepGuard = hasBodyPart(HEAL);

/**
 * Guard that checks if the creep has CLAIM body parts.
 * Pre-configured convenience guard.
 */
export const hasClaimParts: CreepGuard = hasBodyPart(CLAIM);

/**
 * Guard that checks if the creep is damaged.
 *
 * @param ctx - Creep context
 * @returns true if creep hits are below hitsMax
 *
 * @example
 * ```typescript
 * if (isDamaged({ creep })) {
 *   // Creep needs healing
 * }
 * ```
 */
export const isDamaged: CreepGuard = ctx => ctx.creep.hits < ctx.creep.hitsMax;

/**
 * Creates a guard that checks if the creep's health is below a percentage.
 *
 * @param percentage - Health percentage threshold (0-100)
 * @returns Guard function that returns true if health is below percentage
 *
 * @example
 * ```typescript
 * const criticalHealth = isHealthBelow(30);
 * if (criticalHealth({ creep })) {
 *   // Creep health is below 30%
 * }
 * ```
 */
export const isHealthBelow: CreepGuardFactory<number, CreepContext> = percentage => ctx =>
  (ctx.creep.hits / ctx.creep.hitsMax) * 100 < percentage;

/**
 * Guard that checks if the creep is still spawning.
 *
 * @param ctx - Creep context
 * @returns true if creep is still in the spawning process
 *
 * @example
 * ```typescript
 * if (isSpawning({ creep })) {
 *   // Creep is not ready yet
 * }
 * ```
 */
export const isSpawning: CreepGuard = ctx => ctx.creep.spawning;

/**
 * Creates a guard that checks if the creep has at least a certain number of a body part.
 *
 * @param part - Body part constant to count
 * @param count - Minimum number required
 * @returns Guard function that returns true if creep has at least count of the part
 *
 * @example
 * ```typescript
 * const hasMultipleWork = hasMinBodyParts(WORK, 3);
 * if (hasMultipleWork({ creep })) {
 *   // Creep has at least 3 WORK parts
 * }
 * ```
 */
export const hasMinBodyParts: CreepGuardFactory<{ part: BodyPartConstant; count: number }, CreepContext> =
  ({ part, count }) =>
  ctx =>
    ctx.creep.body.filter(p => p.type === part).length >= count;

/**
 * Creates a guard that checks if the creep has active (undamaged) body parts of a type.
 *
 * @param part - Body part constant to check
 * @returns Guard function that returns true if creep has active (undamaged) parts of that type
 *
 * @example
 * ```typescript
 * const canStillWork = hasActiveBodyPart(WORK);
 * if (canStillWork({ creep })) {
 *   // Creep has undamaged WORK parts
 * }
 * ```
 */
export const hasActiveBodyPart: CreepGuardFactory<BodyPartConstant, CreepContext> = part => ctx =>
  ctx.creep.body.some(p => p.type === part && p.hits > 0);

/**
 * Guard that checks if the creep has a role assigned in memory.
 *
 * @param ctx - Creep context
 * @returns true if creep has a role in memory
 */
export const hasRole: CreepGuard = ctx => Boolean((ctx.creep.memory as { role?: string })?.role);

/**
 * Creates a guard that checks if the creep has a specific role.
 *
 * @param role - Role name to check
 * @returns Guard function that returns true if creep has the specified role
 *
 * @example
 * ```typescript
 * const isHarvester = hasRoleType('harvester');
 * if (isHarvester({ creep })) {
 *   // Creep is a harvester
 * }
 * ```
 */
export const hasRoleType: CreepGuardFactory<string, CreepContext> = role => ctx =>
  (ctx.creep.memory as { role?: string })?.role === role;
