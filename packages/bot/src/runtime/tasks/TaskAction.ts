import {
  TaskPrerequisite,
  MinionCanWork,
  MinionCanCarry,
  MinionHasEnergy,
  MinionHasFreeCapacity,
  MinionHasBodyParts
} from "./TaskPrerequisite";
import type { PathfindingManager } from "@runtime/pathfinding";

/**
 * Represents a specific action to be performed by a creep.
 * Based on Jon Winsley's task management architecture.
 */
export abstract class TaskAction {
  /** Prerequisites that must be met before executing this action */
  public abstract prereqs: TaskPrerequisite[];

  /** Optional pathfinding manager for advanced pathfinding */
  protected pathfindingManager?: PathfindingManager;

  /**
   * Set the pathfinding manager for this task action
   */
  public setPathfindingManager(manager: PathfindingManager): void {
    this.pathfindingManager = manager;
  }

  /**
   * Execute the action with the given creep
   * @returns true if action is complete, false if it should continue
   */
  public abstract action(creep: Creep): boolean;

  /**
   * Move creep towards the action target if needed
   * Uses pathfinding manager if available, otherwise falls back to default creep.moveTo
   */
  protected moveToTarget(creep: Creep, target: RoomPosition | { pos: RoomPosition }, range = 1): void {
    const targetPos = target instanceof RoomPosition ? target : target.pos;
    if (creep.pos.getRangeTo(targetPos) > range) {
      if (this.pathfindingManager) {
        this.pathfindingManager.moveTo(creep, targetPos, { range, reusePath: 5 });
      } else {
        creep.moveTo(targetPos, { range, reusePath: 5 });
      }
    }
  }
}

/**
 * Harvest energy from a source
 */
export class HarvestAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private sourceId: Id<Source>;

  public constructor(sourceId: Id<Source>) {
    super();
    this.sourceId = sourceId;
    this.prereqs = [new MinionCanWork(), new MinionHasFreeCapacity(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getSourceId(): Id<Source> {
    return this.sourceId;
  }

  public action(creep: Creep): boolean {
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
  public prereqs: TaskPrerequisite[];
  private siteId: Id<ConstructionSite>;

  public constructor(siteId: Id<ConstructionSite>) {
    super();
    this.siteId = siteId;
    this.prereqs = [new MinionCanWork(), new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getSiteId(): Id<ConstructionSite> {
    return this.siteId;
  }

  public action(creep: Creep): boolean {
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
  public prereqs: TaskPrerequisite[];
  private structureId: Id<Structure>;

  public constructor(structureId: Id<Structure>) {
    super();
    this.structureId = structureId;
    this.prereqs = [new MinionCanWork(), new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getStructureId(): Id<Structure> {
    return this.structureId;
  }

  public action(creep: Creep): boolean {
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
  public prereqs: TaskPrerequisite[];
  private controllerId: Id<StructureController>;

  public constructor(controllerId: Id<StructureController>) {
    super();
    this.controllerId = controllerId;
    this.prereqs = [new MinionCanWork(), new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public action(creep: Creep): boolean {
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
  public prereqs: TaskPrerequisite[];
  private targetId: Id<AnyStoreStructure>;
  private resourceType: ResourceConstant;

  public constructor(targetId: Id<AnyStoreStructure>, resourceType: ResourceConstant = RESOURCE_ENERGY) {
    super();
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.prereqs = [new MinionCanCarry(), new MinionHasBodyParts({ [CARRY]: 1 })];

    if (resourceType === RESOURCE_ENERGY) {
      this.prereqs.push(new MinionHasEnergy());
    }
  }

  public getTargetId(): Id<AnyStoreStructure> {
    return this.targetId;
  }

  public action(creep: Creep): boolean {
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
  public prereqs: TaskPrerequisite[];
  private targetId: Id<AnyStoreStructure>;
  private resourceType: ResourceConstant;

  public constructor(targetId: Id<AnyStoreStructure>, resourceType: ResourceConstant = RESOURCE_ENERGY) {
    super();
    this.targetId = targetId;
    this.resourceType = resourceType;
    this.prereqs = [new MinionCanCarry(), new MinionHasFreeCapacity(), new MinionHasBodyParts({ [CARRY]: 1 })];
  }

  public action(creep: Creep): boolean {
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

/**
 * Move to a specific position
 */
export class MoveAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [];
  private targetPos: RoomPosition;
  private range: number;

  public constructor(targetPos: RoomPosition, range = 1) {
    super();
    this.targetPos = targetPos;
    this.range = range;
  }

  public action(creep: Creep): boolean {
    if (creep.pos.getRangeTo(this.targetPos) <= this.range) {
      return true; // Already at destination
    }

    this.moveToTarget(creep, this.targetPos, this.range);
    return false;
  }
}

/**
 * Spawn a new creep
 */
export class SpawnAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [];
  private spawnId: Id<StructureSpawn>;
  private body: BodyPartConstant[];
  private name: string;
  private memory: CreepMemory;

  public constructor(spawnId: Id<StructureSpawn>, body: BodyPartConstant[], name: string, memory: CreepMemory) {
    super();
    this.spawnId = spawnId;
    this.body = body;
    this.name = name;
    this.memory = memory;
  }

  public action(_creep: Creep): boolean {
    const spawn = Game.getObjectById(this.spawnId);
    if (!spawn || spawn.spawning) {
      return false; // Spawn not available
    }

    const result = spawn.spawnCreep(this.body, this.name, { memory: this.memory });
    return result === OK || result === ERR_NAME_EXISTS;
  }
}

/**
 * Place a construction site
 */
export class PlaceConstructionSiteAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [];
  private pos: RoomPosition;
  private structureType: BuildableStructureConstant;

  public constructor(pos: RoomPosition, structureType: BuildableStructureConstant) {
    super();
    this.pos = pos;
    this.structureType = structureType;
  }

  public action(_creep: Creep): boolean {
    const room = Game.rooms[this.pos.roomName];
    if (!room) {
      // Room not visible - cannot place construction site
      // Keep task pending until room becomes visible
      return false;
    }

    const result = room.createConstructionSite(this.pos.x, this.pos.y, this.structureType);
    // Complete if placed successfully or already exists
    return result === OK || result === ERR_INVALID_TARGET;
  }
}
