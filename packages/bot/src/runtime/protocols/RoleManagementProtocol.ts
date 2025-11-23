import { protocol } from "@ralphschuler/screeps-kernel";

/**
 * Role counts by role type.
 */
export type RoleCounts = Record<string, number>;

/**
 * Role management protocol interface for type safety.
 * Handles role bookkeeping and creep count coordination.
 */
export interface IRoleManagementProtocol {
  /**
   * Set role counts (typically called by MemoryProcess).
   * @param counts - Map of role names to counts
   */
  setRoleCounts(counts: RoleCounts): void;

  /**
   * Get role counts (typically read by BehaviorProcess).
   * @returns Map of role names to counts
   */
  getRoleCounts(): RoleCounts;

  /**
   * Get count for a specific role.
   * @param role - Role name
   * @returns Count for the role (0 if not found)
   */
  getRoleCount(role: string): number;

  /**
   * Clear all role counts.
   */
  clearRoleCounts(): void;
}

/**
 * Protocol for managing creep role counts between processes.
 * Replaces Memory.roles communication pattern.
 *
 * @example
 * // MemoryProcess updates role counts
 * ctx.protocol.setRoleCounts({ harvester: 3, upgrader: 2 });
 *
 * @example
 * // BehaviorProcess reads role counts
 * const roleCounts = ctx.protocol.getRoleCounts();
 */
@protocol({ name: "RoleManagementProtocol" })
export class RoleManagementProtocol implements IRoleManagementProtocol {
  private roleCounts: RoleCounts = {};

  public setRoleCounts(counts: RoleCounts): void {
    this.roleCounts = { ...counts };
  }

  public getRoleCounts(): RoleCounts {
    return { ...this.roleCounts };
  }

  public getRoleCount(role: string): number {
    return this.roleCounts[role] ?? 0;
  }

  public clearRoleCounts(): void {
    this.roleCounts = {};
  }
}
