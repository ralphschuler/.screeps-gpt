/**
 * Base interface for role controllers.
 * Each role controller is responsible for:
 * - Defining role configuration (minimum count, body pattern, initial memory)
 * - Executing role-specific behavior logic
 */

import type { CreepLike } from "@runtime/types/GameContext";

/**
 * Role configuration defining minimum creeps, body composition, and initial memory
 */
export interface RoleConfig<TMemory extends CreepMemory = CreepMemory> {
  /** Minimum number of creeps of this role that should be maintained */
  minimum: number;
  /** Default body parts for this role */
  body: BodyPartConstant[];
  /** Factory function to create initial memory for a new creep */
  createMemory: () => TMemory;
  /** Current version of this role's logic (for migration purposes) */
  version: number;
}

/**
 * Base interface that all role controllers must implement
 */
export interface RoleController<TMemory extends CreepMemory = CreepMemory> {
  /**
   * Get the role name this controller handles
   */
  getRoleName(): string;

  /**
   * Get the configuration for this role
   */
  getConfig(): RoleConfig<TMemory>;

  /**
   * Execute behavior logic for a creep of this role.
   * Returns the current task name for metrics/logging.
   *
   * @param creep - The creep to execute behavior for
   * @returns The current task name (e.g., "harvest", "deliver", etc.)
   */
  execute(creep: CreepLike): string;

  /**
   * Validate and migrate creep memory if needed.
   * Called before execute() to ensure memory is in expected format.
   *
   * @param creep - The creep to validate memory for
   */
  validateMemory(creep: CreepLike): void;
}

/**
 * Abstract base class providing common functionality for role controllers
 */
export abstract class BaseRoleController<TMemory extends CreepMemory = CreepMemory>
  implements RoleController<TMemory>
{
  protected readonly config: RoleConfig<TMemory>;

  public constructor(config: RoleConfig<TMemory>) {
    this.config = config;
  }

  public abstract getRoleName(): string;

  public getConfig(): RoleConfig<TMemory> {
    return this.config;
  }

  public abstract execute(creep: CreepLike): string;

  /**
   * Default memory validation: ensure task and version are set correctly
   */
  public validateMemory(creep: CreepLike): void {
    const memory = creep.memory as Partial<TMemory>;
    const defaults = this.config.createMemory();

    // Update version if outdated
    if (memory.version !== this.config.version) {
      memory.task = defaults.task;
      memory.version = this.config.version;
    }

    // Ensure task is set
    if (typeof memory.task !== "string") {
      memory.task = defaults.task;
    }

    // Ensure role is set
    memory.role = this.getRoleName();
  }
}
