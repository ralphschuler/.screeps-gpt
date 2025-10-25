import type { TaskPrerequisite } from "./TaskPrerequisite";

/**
 * Represents a specific action to be performed by a creep.
 * Based on Jon Winsley's task management architecture.
 */
export abstract class TaskAction {
  /** Prerequisites that must be met before executing this action */
  abstract prereqs: TaskPrerequisite[];

  /**
   * Execute the action with the given creep
   * @returns true if action is complete, false if it should continue
   */
  abstract action(creep: Creep): boolean;

  /**
   * Move creep towards the action target if needed
   */
  protected moveToTarget(creep: Creep, target: RoomPosition | { pos: RoomPosition }, range = 1): void {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    if (creep.pos.getRangeTo(targetPos) > range) {
      creep.moveTo(targetPos, { range, reusePath: 5 });
    }
  }
}

/**
 * Harvest energy from a source
 */
export class HarvestAction extends TaskAction {
  prereqs: TaskPrerequisite[];
  private sourceId: Id<Source>;

  constructor(sourceId: Id<Source>) {
    super();
    this.sourceId = sourceId;
    this.prereqs = [
      new (require("./TaskPrerequisite").MinionCanWork)(),
      new (require("./TaskPrerequisite").MinionHasFreeCapacity)()
    ];
  }

  action(creep: Creep): boolean {
    const source = Game.getObjectById(this.sourceId);
    if (!source) {
      return true; // Source doesn't exist, task complete
    }

    const result = creep.harvest(source);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, source, 1);
      return false;
    }

    if (result === OK) {
      // Continue harvesting until full
      return creep.store.getFreeCapacity() === 0;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Build a construction site
 */
export class BuildAction extends TaskAction {
  prereqs: TaskPrerequisite[];
  private siteId: Id<ConstructionSite>;

  constructor(siteId: Id<ConstructionSite>) {
    super();
    this.siteId = siteId;
    this.prereqs = [
      new (require("./TaskPrerequisite").MinionCanWork)(),
      new (require("./TaskPrerequisite").MinionHasEnergy)()
    ];
  }

  action(creep: Creep): boolean {
    const site = Game.getObjectById(this.siteId);
    if (!site) {
      return true; // Site doesn't exist or complete
    }

    const result = creep.build(site);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, site, 3);
      return false;
    }

    if (result === OK) {
      // Continue building until out of energy or site complete
      return creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Repair a structure
 */
export class RepairAction extends TaskAction {
  prereqs: TaskPrerequisite[];
  private structureId: Id<Structure>;

  constructor(structureId: Id<Structure>) {
    super();
    this.structureId = structureId;
    this.prereqs = [
      new (require("./TaskPrerequisite").MinionCanWork)(),
      new (require("./TaskPrerequisite").MinionHasEnergy)()
    ];
  }

  action(creep: Creep): boolean {
    const structure = Game.getObjectById(this.structureId);
    if (!structure || structure.hits === structure.hitsMax) {
      return true; // Structure doesn't exist or fully repaired
    }

    const result = creep.repair(structure);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, structure, 3);
      return false;
    }

    if (result === OK) {
      // Continue repairing until out of energy or structure repaired
      return creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0 || structure.hits === structure.hitsMax;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Upgrade controller
 */
export class UpgradeAction extends TaskAction {
  prereqs: TaskPrerequisite[];
  private controllerId: Id<StructureController>;

  constructor(controllerId: Id<StructureController>) {
    super();
    this.controllerId = controllerId;
    this.prereqs = [
      new (require("./TaskPrerequisite").MinionCanWork)(),
      new (require("./TaskPrerequisite").MinionHasEnergy)()
    ];
  }

  action(creep: Creep): boolean {
    const controller = Game.getObjectById(this.controllerId);
    if (!controller) {
      return true; // Controller doesn't exist
    }

    const result = creep.upgradeController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, controller, 3);
      return false;
    }

    if (result === OK) {
      // Continue upgrading until out of energy
      return creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Transfer resource to a structure
 */
export class TransferAction extends TaskAction {
  prereqs: TaskPrerequisite[];
  private targetId: Id<AnyStoreStructure>;
  private resourceType: ResourceConstant;

  constructor(targetId: Id<AnyStoreStructure>, resourceType: ResourceConstant = RESOURCE_ENERGY) {
    super();
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.prereqs = [new (require("./TaskPrerequisite").MinionCanCarry)()];

    if (resourceType === RESOURCE_ENERGY) {
      this.prereqs.push(new (require("./TaskPrerequisite").MinionHasEnergy)());
    }
  }

  action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target || target.store.getFreeCapacity(this.resourceType) === 0) {
      return true; // Target doesn't exist or is full
    }

    const result = creep.transfer(target, this.resourceType);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 1);
      return false;
    }

    if (result === OK) {
      // Continue transferring until empty or target full
      return creep.store.getUsedCapacity(this.resourceType) === 0;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Withdraw resource from a structure
 */
export class WithdrawAction extends TaskAction {
  prereqs: TaskPrerequisite[];
  private targetId: Id<AnyStoreStructure>;
  private resourceType: ResourceConstant;

  constructor(targetId: Id<AnyStoreStructure>, resourceType: ResourceConstant = RESOURCE_ENERGY) {
    super();
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.prereqs = [
      new (require("./TaskPrerequisite").MinionCanCarry)(),
      new (require("./TaskPrerequisite").MinionHasFreeCapacity)()
    ];
  }

  action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target || target.store.getUsedCapacity(this.resourceType) === 0) {
      return true; // Target doesn't exist or is empty
    }

    const result = creep.withdraw(target, this.resourceType);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 1);
      return false;
    }

    if (result === OK) {
      // Continue withdrawing until full or target empty
      return creep.store.getFreeCapacity() === 0;
    }

    // Error occurred, end task
    return true;
  }
}
