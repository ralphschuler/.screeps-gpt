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

/**
 * Prerequisite: Spawn has sufficient energy to spawn a creep
 */
export class SpawnHasEnergy extends TaskPrerequisite {
  private readonly spawnId: Id<StructureSpawn>;
  private readonly requiredEnergy: number;

  public constructor(spawnId: Id<StructureSpawn>, requiredEnergy: number) {
    super();
    this.spawnId = spawnId;
    this.requiredEnergy = requiredEnergy;
  }

  public meets(_creep: Creep): boolean {
    const spawn = Game.getObjectById(this.spawnId);
    if (!spawn) return false;

    // Check if spawn and its extensions have enough energy
    const room = spawn.room;
    const availableEnergy = room.energyAvailable;
    return availableEnergy >= this.requiredEnergy;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // TODO: Generate energy gathering tasks to fill spawn and extensions
    // For now, return empty - higher level logic should handle this
    // Future implementation should create harvest/transfer tasks
    return [];
  }
}

/**
 * Prerequisite: Structure has required capacity
 */
export class StructureHasCapacity extends TaskPrerequisite {
  private readonly structureId: Id<AnyStoreStructure>;
  private readonly resourceType: ResourceConstant;
  private readonly minCapacity: number;

  public constructor(structureId: Id<AnyStoreStructure>, resourceType: ResourceConstant, minCapacity: number) {
    super();
    this.structureId = structureId;
    this.resourceType = resourceType;
    this.minCapacity = minCapacity;
  }

  public meets(_creep: Creep): boolean {
    const structure = Game.getObjectById(this.structureId);
    if (!structure) return false;

    return structure.store.getFreeCapacity(this.resourceType) >= this.minCapacity;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Capacity requirements cannot be met through subtasks
    // Structure capacity is a property that cannot be changed at runtime
    return [];
  }
}

/**
 * Prerequisite: Creep has minimum count of functional body parts
 * Only counts parts with hits > 0 (undamaged parts)
 */
export class MinionHasBodyParts extends TaskPrerequisite {
  private readonly requiredParts: Partial<Record<BodyPartConstant, number>>;

  public constructor(requiredParts: Partial<Record<BodyPartConstant, number>>) {
    super();
    this.requiredParts = requiredParts;
  }

  public meets(creep: Creep): boolean {
    for (const [partType, minCount] of Object.entries(this.requiredParts)) {
      const functionalCount = creep.body.filter(part => part.type === partType && part.hits > 0).length;

      if (functionalCount < (minCount ?? 0)) {
        return false;
      }
    }
    return true;
  }

  public toMeet(_creep: Creep): TaskAction[] {
    // Cannot modify body composition of existing creep
    return [];
  }
}
