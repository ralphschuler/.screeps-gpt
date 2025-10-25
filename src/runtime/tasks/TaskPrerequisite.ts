/**
 * Represents a prerequisite that must be met before a task can be executed.
 * Based on Jon Winsley's task management architecture.
 */
export abstract class TaskPrerequisite {
  /**
   * Check if the creep meets this prerequisite
   */
  abstract meets(creep: Creep): boolean;

  /**
   * Generate subtasks to help the creep meet this prerequisite
   * Returns empty array if prerequisite cannot be met
   */
  abstract toMeet(creep: Creep): TaskAction[];
}

/**
 * Prerequisite: Creep has WORK body parts
 */
export class MinionCanWork extends TaskPrerequisite {
  meets(creep: Creep): boolean {
    return creep.body.some(part => part.type === WORK);
  }

  toMeet(_creep: Creep): TaskAction[] {
    // Cannot add body parts to existing creep
    return [];
  }
}

/**
 * Prerequisite: Creep has CARRY body parts
 */
export class MinionCanCarry extends TaskPrerequisite {
  meets(creep: Creep): boolean {
    return creep.body.some(part => part.type === CARRY);
  }

  toMeet(_creep: Creep): TaskAction[] {
    // Cannot add body parts to existing creep
    return [];
  }
}

/**
 * Prerequisite: Creep has energy
 */
export class MinionHasEnergy extends TaskPrerequisite {
  private readonly minAmount: number;

  constructor(minAmount = 1) {
    super();
    this.minAmount = minAmount;
  }

  meets(creep: Creep): boolean {
    return creep.store.getUsedCapacity(RESOURCE_ENERGY) >= this.minAmount;
  }

  toMeet(creep: Creep): TaskAction[] {
    // Generate harvest or withdraw tasks to get energy
    const sources = creep.room.find(FIND_SOURCES_ACTIVE);
    if (sources.length > 0) {
      const source = creep.pos.findClosestByPath(sources) ?? sources[0];
      return [new HarvestAction(source.id)];
    }

    // Try to withdraw from storage/containers
    const energyStores = creep.room.find(FIND_STRUCTURES, {
      filter: (s: AnyStructure) => {
        if (
          s.structureType !== STRUCTURE_STORAGE &&
          s.structureType !== STRUCTURE_CONTAINER &&
          s.structureType !== STRUCTURE_SPAWN &&
          s.structureType !== STRUCTURE_EXTENSION
        ) {
          return false;
        }
        return (s as AnyStoreStructure).store.getUsedCapacity(RESOURCE_ENERGY) > 0;
      }
    }) as AnyStoreStructure[];

    if (energyStores.length > 0) {
      const store = creep.pos.findClosestByPath(energyStores) ?? energyStores[0];
      return [new WithdrawAction(store.id, RESOURCE_ENERGY)];
    }

    return [];
  }
}

/**
 * Prerequisite: Creep has free capacity
 */
export class MinionHasFreeCapacity extends TaskPrerequisite {
  private readonly minAmount: number;

  constructor(minAmount = 1) {
    super();
    this.minAmount = minAmount;
  }

  meets(creep: Creep): boolean {
    return creep.store.getFreeCapacity() >= this.minAmount;
  }

  toMeet(_creep: Creep): TaskAction[] {
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

  constructor(target: RoomPosition, range = 1) {
    super();
    this.target = target;
    this.range = range;
  }

  meets(creep: Creep): boolean {
    return creep.pos.getRangeTo(this.target) <= this.range;
  }

  toMeet(creep: Creep): TaskAction[] {
    // Movement is handled separately, not as a task
    // This prerequisite will be checked each tick
    return [];
  }
}

// Forward declaration - defined in TaskAction.ts
import type { TaskAction } from "./TaskAction";
import { HarvestAction, WithdrawAction } from "./TaskAction";
