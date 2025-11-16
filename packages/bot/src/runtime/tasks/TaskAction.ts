import { TaskPrerequisite, MinionHasEnergy, MinionHasFreeCapacity, MinionHasBodyParts } from "./TaskPrerequisite";
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
   * Get the target position for this action.
   * Used for distance calculations during task assignment.
   * @returns RoomPosition of the task target, or null if target doesn't exist
   */
  public abstract getTargetPos(): RoomPosition | null;

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
    this.prereqs = [new MinionHasFreeCapacity(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getSourceId(): Id<Source> {
    return this.sourceId;
  }

  public getTargetPos(): RoomPosition | null {
    const source = Game.getObjectById(this.sourceId);
    return source ? source.pos : null;
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
    this.prereqs = [new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getSiteId(): Id<ConstructionSite> {
    return this.siteId;
  }

  public getTargetPos(): RoomPosition | null {
    const site = Game.getObjectById(this.siteId);
    return site ? site.pos : null;
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
    this.prereqs = [new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getStructureId(): Id<Structure> {
    return this.structureId;
  }

  public getTargetPos(): RoomPosition | null {
    const structure = Game.getObjectById(this.structureId);
    return structure ? structure.pos : null;
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
    this.prereqs = [new MinionHasEnergy(), new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getTargetPos(): RoomPosition | null {
    const controller = Game.getObjectById(this.controllerId);
    return controller ? controller.pos : null;
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
    this.prereqs = [new MinionHasBodyParts({ [CARRY]: 1 })];

    if (resourceType === RESOURCE_ENERGY) {
      this.prereqs.push(new MinionHasEnergy());
    }
  }

  public getTargetId(): Id<AnyStoreStructure> {
    return this.targetId;
  }

  public getTargetPos(): RoomPosition | null {
    const target = Game.getObjectById(this.targetId);
    return target ? target.pos : null;
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
    this.prereqs = [new MinionHasFreeCapacity(), new MinionHasBodyParts({ [CARRY]: 1 })];
  }

  public getTargetPos(): RoomPosition | null {
    const target = Game.getObjectById(this.targetId);
    return target ? target.pos : null;
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

  public getTargetPos(): RoomPosition | null {
    return this.targetPos;
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

  public getTargetPos(): RoomPosition | null {
    const spawn = Game.getObjectById(this.spawnId);
    return spawn ? spawn.pos : null;
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

  public getTargetPos(): RoomPosition | null {
    return this.pos;
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

/**
 * Pickup a dropped resource
 */
export class PickupAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private resourceId: Id<Resource>;

  public constructor(resourceId: Id<Resource>) {
    super();
    this.resourceId = resourceId;
    this.prereqs = [new MinionHasFreeCapacity(), new MinionHasBodyParts({ [CARRY]: 1 })];
  }

  public getResourceId(): Id<Resource> {
    return this.resourceId;
  }

  public getTargetPos(): RoomPosition | null {
    const resource = Game.getObjectById(this.resourceId);
    return resource ? resource.pos : null;
  }

  public action(creep: Creep): boolean {
    const resource = Game.getObjectById(this.resourceId);
    if (!resource) {
      return true; // Resource doesn't exist or was picked up
    }

    const result = creep.pickup(resource);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, resource, 1);
      return false;
    }

    if (result === OK) {
      // Task complete after pickup
      return true;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Drop a resource at current position
 */
export class DropAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [];
  private resourceType: ResourceConstant;
  private amount?: number;

  public constructor(resourceType: ResourceConstant, amount?: number) {
    super();
    this.resourceType = resourceType;
    this.amount = amount;
  }

  public getTargetPos(): RoomPosition | null {
    // Drop happens at creep's current position
    return null;
  }

  public action(creep: Creep): boolean {
    const amountToDrop = this.amount ?? creep.store.getUsedCapacity(this.resourceType);
    
    if (amountToDrop === 0) {
      return true; // Nothing to drop
    }

    const result = creep.drop(this.resourceType, amountToDrop);
    return result === OK || result === ERR_NOT_ENOUGH_RESOURCES;
  }
}

/**
 * Claim a controller
 */
export class ClaimAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private controllerId: Id<StructureController>;

  public constructor(controllerId: Id<StructureController>) {
    super();
    this.controllerId = controllerId;
    this.prereqs = [new MinionHasBodyParts({ [CLAIM]: 1 })];
  }

  public getTargetPos(): RoomPosition | null {
    const controller = Game.getObjectById(this.controllerId);
    return controller ? controller.pos : null;
  }

  public action(creep: Creep): boolean {
    const controller = Game.getObjectById(this.controllerId);
    if (!controller) {
      return true; // Controller doesn't exist
    }

    const result = creep.claimController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, controller, 1);
      return false;
    }

    // Task complete on success or if already claimed
    return result === OK || result === ERR_GCL_NOT_ENOUGH;
  }
}

/**
 * Reserve a controller
 */
export class ReserveAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private controllerId: Id<StructureController>;

  public constructor(controllerId: Id<StructureController>) {
    super();
    this.controllerId = controllerId;
    this.prereqs = [new MinionHasBodyParts({ [CLAIM]: 1 })];
  }

  public getTargetPos(): RoomPosition | null {
    const controller = Game.getObjectById(this.controllerId);
    return controller ? controller.pos : null;
  }

  public action(creep: Creep): boolean {
    const controller = Game.getObjectById(this.controllerId);
    if (!controller) {
      return true; // Controller doesn't exist
    }

    const result = creep.reserveController(controller);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, controller, 1);
      return false;
    }

    if (result === OK) {
      // Continue reserving until out of CLAIM parts or max reservation reached
      return false;
    }

    // Error occurred or max reservation reached, end task
    return true;
  }
}

/**
 * Attack a target
 */
export class AttackAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private targetId: Id<Creep | Structure>;

  public constructor(targetId: Id<Creep | Structure>) {
    super();
    this.targetId = targetId;
    this.prereqs = [new MinionHasBodyParts({ [ATTACK]: 1 })];
  }

  public getTargetId(): Id<Creep | Structure> {
    return this.targetId;
  }

  public getTargetPos(): RoomPosition | null {
    const target = Game.getObjectById(this.targetId);
    return target ? target.pos : null;
  }

  public action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return true; // Target doesn't exist or was destroyed
    }

    const result = creep.attack(target);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 1);
      return false;
    }

    if (result === OK) {
      // Continue attacking until target is destroyed
      return false;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Ranged attack a target
 */
export class RangedAttackAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private targetId: Id<Creep | Structure>;

  public constructor(targetId: Id<Creep | Structure>) {
    super();
    this.targetId = targetId;
    this.prereqs = [new MinionHasBodyParts({ [RANGED_ATTACK]: 1 })];
  }

  public getTargetId(): Id<Creep | Structure> {
    return this.targetId;
  }

  public getTargetPos(): RoomPosition | null {
    const target = Game.getObjectById(this.targetId);
    return target ? target.pos : null;
  }

  public action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target) {
      return true; // Target doesn't exist or was destroyed
    }

    const result = creep.rangedAttack(target);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 3);
      return false;
    }

    if (result === OK) {
      // Continue attacking until target is destroyed
      return false;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Heal a creep
 */
export class HealAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private targetId: Id<Creep>;

  public constructor(targetId: Id<Creep>) {
    super();
    this.targetId = targetId;
    this.prereqs = [new MinionHasBodyParts({ [HEAL]: 1 })];
  }

  public getTargetId(): Id<Creep> {
    return this.targetId;
  }

  public getTargetPos(): RoomPosition | null {
    const target = Game.getObjectById(this.targetId);
    return target ? target.pos : null;
  }

  public action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target || target.hits === target.hitsMax) {
      return true; // Target doesn't exist or is fully healed
    }

    const result = creep.heal(target);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 1);
      return false;
    }

    if (result === OK) {
      // Continue healing until target is fully healed
      return target.hits === target.hitsMax;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Ranged heal a creep
 */
export class RangedHealAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private targetId: Id<Creep>;

  public constructor(targetId: Id<Creep>) {
    super();
    this.targetId = targetId;
    this.prereqs = [new MinionHasBodyParts({ [HEAL]: 1 })];
  }

  public getTargetId(): Id<Creep> {
    return this.targetId;
  }

  public getTargetPos(): RoomPosition | null {
    const target = Game.getObjectById(this.targetId);
    return target ? target.pos : null;
  }

  public action(creep: Creep): boolean {
    const target = Game.getObjectById(this.targetId);
    if (!target || target.hits === target.hitsMax) {
      return true; // Target doesn't exist or is fully healed
    }

    const result = creep.rangedHeal(target);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, target, 3);
      return false;
    }

    if (result === OK) {
      // Continue healing until target is fully healed
      return target.hits === target.hitsMax;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Dismantle a structure
 */
export class DismantleAction extends TaskAction {
  public prereqs: TaskPrerequisite[];
  private structureId: Id<Structure>;

  public constructor(structureId: Id<Structure>) {
    super();
    this.structureId = structureId;
    this.prereqs = [new MinionHasBodyParts({ [WORK]: 1 })];
  }

  public getStructureId(): Id<Structure> {
    return this.structureId;
  }

  public getTargetPos(): RoomPosition | null {
    const structure = Game.getObjectById(this.structureId);
    return structure ? structure.pos : null;
  }

  public action(creep: Creep): boolean {
    const structure = Game.getObjectById(this.structureId);
    if (!structure) {
      return true; // Structure doesn't exist or was dismantled
    }

    const result = creep.dismantle(structure);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, structure, 1);
      return false;
    }

    if (result === OK) {
      // Continue dismantling until structure is destroyed
      return false;
    }

    // Error occurred, end task
    return true;
  }
}

/**
 * Sign a controller
 */
export class SignControllerAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [];
  private controllerId: Id<StructureController>;
  private text: string;

  public constructor(controllerId: Id<StructureController>, text: string) {
    super();
    this.controllerId = controllerId;
    this.text = text;
  }

  public getTargetPos(): RoomPosition | null {
    const controller = Game.getObjectById(this.controllerId);
    return controller ? controller.pos : null;
  }

  public action(creep: Creep): boolean {
    const controller = Game.getObjectById(this.controllerId);
    if (!controller) {
      return true; // Controller doesn't exist
    }

    const result = creep.signController(controller, this.text);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, controller, 1);
      return false;
    }

    // Task complete on success or error
    return true;
  }
}

/**
 * Recycle creep at spawn
 */
export class RecycleAction extends TaskAction {
  public prereqs: TaskPrerequisite[] = [];
  private spawnId: Id<StructureSpawn>;

  public constructor(spawnId: Id<StructureSpawn>) {
    super();
    this.spawnId = spawnId;
  }

  public getTargetPos(): RoomPosition | null {
    const spawn = Game.getObjectById(this.spawnId);
    return spawn ? spawn.pos : null;
  }

  public action(creep: Creep): boolean {
    const spawn = Game.getObjectById(this.spawnId);
    if (!spawn) {
      return true; // Spawn doesn't exist
    }

    const result = spawn.recycleCreep(creep);
    if (result === ERR_NOT_IN_RANGE) {
      this.moveToTarget(creep, spawn, 1);
      return false;
    }

    // Task complete on success (creep will be recycled) or error
    return true;
  }
}
