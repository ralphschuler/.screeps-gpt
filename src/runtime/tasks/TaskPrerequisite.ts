import type { TaskAction } from "./TaskAction";

/**
 * Represents a prerequisite that must be met before a task can be executed.
 * Based on Jon Winsley's task management architecture.
 */
export abstract class TaskPrerequisite {
  /**
   * Check if the creep meets this prerequisite
   */
  public abstract meets(creep: Creep): boolean;

  /**
   * Generate subtasks to help the creep meet this prerequisite
   * Returns empty array if prerequisite cannot be met
   */
  public abstract toMeet(creep: Creep): TaskAction[];
}

/**
 * Prerequisite: Creep has WORK body parts
 */
export class MinionCanWork extends TaskPrerequisite {
  public meets(creep: Creep): boolean {
    return creep.body.some(part => part.type === WORK);
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Cannot add body parts to existing creep
    return [];
  }
}

/**
 * Prerequisite: Creep has CARRY body parts
 */
export class MinionCanCarry extends TaskPrerequisite {
  public meets(creep: Creep): boolean {
    return creep.body.some(part => part.type === CARRY);
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Cannot add body parts to existing creep
    return [];
  }
}

/**
 * Prerequisite: Creep has energy
 */
export class MinionHasEnergy extends TaskPrerequisite {
  private readonly minAmount: number;

  public constructor(minAmount = 1) {
    super();
    this.minAmount = minAmount;
  }

  public meets(creep: Creep): boolean {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) >= this.minAmount;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Subtask generation deferred to avoid circular dependency
    // Task manager should handle generating appropriate harvest/withdraw tasks
    return [];
  }
}

/**
 * Prerequisite: Creep has free capacity
 */
export class MinionHasFreeCapacity extends TaskPrerequisite {
  private readonly minAmount: number;

  public constructor(minAmount = 1) {
    super();
    this.minAmount = minAmount;
  }

  public meets(creep: Creep): boolean {
    return creep.store.getFreeCapacity() >= this.minAmount;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Could generate transfer tasks to empty inventory
    // For now, return empty - let higher level logic handle this
    return [];
  }
}

/**
 * Prerequisite: Creep is near a position
 */
export class MinionIsNear extends TaskPrerequisite {
  private readonly target: RoomPosition;
  private readonly range: number;

  public constructor(target: RoomPosition, range = 1) {
    super();
    this.target = target;
    this.range = range;
  }

  public meets(creep: Creep): boolean {
    return creep.pos.getRangeTo(this.target) <= this.range;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Movement is handled separately, not as a task
    // This prerequisite will be checked each tick
    return [];
  }
}
