/**
 * Remote Hauler Role Controller
 *
 * Remote haulers are responsible for:
 * - Traveling to remote rooms
 * - Picking up energy from containers or dropped resources
 * - Returning home to deliver energy
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, ROOM_CENTER_X, ROOM_CENTER_Y } from "./helpers";

const REMOTE_HAULER_TRAVEL_TASK = "remoteTravel" as const;
const REMOTE_HAULER_PICKUP_TASK = "remotePickup" as const;
const REMOTE_HAULER_RETURN_TASK = "remoteReturn" as const;

type RemoteHaulerTask =
  | typeof REMOTE_HAULER_TRAVEL_TASK
  | typeof REMOTE_HAULER_PICKUP_TASK
  | typeof REMOTE_HAULER_RETURN_TASK;

interface RemoteHaulerMemory extends CreepMemory {
  role: "remoteHauler";
  task: RemoteHaulerTask;
  version: number;
  homeRoom: string;
  targetRoom: string;
}

/**
 *
 */
export class RemoteHaulerController extends BaseRoleController<RemoteHaulerMemory> {
  public constructor() {
    const config: RoleConfig<RemoteHaulerMemory> = {
      minimum: 0,
      body: [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "remoteHauler",
        task: REMOTE_HAULER_TRAVEL_TASK,
        version: 1,
        homeRoom: "",
        targetRoom: ""
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "remoteHauler";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as RemoteHaulerMemory;
    const task = this.ensureTask(memory, creep);
    this.ensureRemoteAssignments(memory, creep);
    const comm = serviceRegistry.getCommunicationManager();

    if (task === REMOTE_HAULER_TRAVEL_TASK) {
      comm?.say(creep, "travel");

      if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
        creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.targetRoom), { reusePath: 50 });
        return REMOTE_HAULER_TRAVEL_TASK;
      }

      // Transition to pickup when arrived and away from edges
      const isNearEdge = creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
      if (!isNearEdge) {
        memory.task = REMOTE_HAULER_PICKUP_TASK;
      }

      return REMOTE_HAULER_TRAVEL_TASK;
    }

    if (memory.task === REMOTE_HAULER_PICKUP_TASK) {
      comm?.say(creep, "pickup");

      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        memory.task = REMOTE_HAULER_RETURN_TASK;
        comm?.say(creep, "full");
        return REMOTE_HAULER_RETURN_TASK;
      }

      // Try to pick up dropped energy first
      if (tryPickupDroppedEnergy(creep, 20)) {
        return REMOTE_HAULER_PICKUP_TASK;
      }

      // Pick up from containers
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: s =>
          s.structureType === STRUCTURE_CONTAINER &&
          (s as StructureContainer).store.getUsedCapacity(RESOURCE_ENERGY) > 0
      }) as StructureContainer[];

      if (containers.length > 0) {
        const closest = creep.pos.findClosestByPath(containers);
        const target = closest ?? containers[0];
        const result = creep.withdraw(target, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, { range: 1, reusePath: 40 });
        }
      }

      return REMOTE_HAULER_PICKUP_TASK;
    }

    // REMOTE_HAULER_RETURN_TASK
    comm?.say(creep, "deliver");

    if (memory.homeRoom && creep.room.name !== memory.homeRoom) {
      creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.homeRoom), { reusePath: 50 });
      return REMOTE_HAULER_RETURN_TASK;
    }

    // Check if near edge in home room
    if (memory.homeRoom && creep.room.name === memory.homeRoom) {
      const isNearEdge = creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
      if (isNearEdge) {
        creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.homeRoom), { reusePath: 50 });
        return REMOTE_HAULER_RETURN_TASK;
      }
    }

    // Deliver to storage/containers/spawns
    const depositTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        (structure.structureType === STRUCTURE_STORAGE ||
          structure.structureType === STRUCTURE_CONTAINER ||
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION) &&
        (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }) as AnyStoreStructure[];

    const depositTarget =
      depositTargets.length > 0 ? (creep.pos.findClosestByPath(depositTargets) ?? depositTargets[0]) : null;
    if (depositTarget) {
      const result = creep.transfer(depositTarget, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(depositTarget, { range: 1, reusePath: 40 });
      } else if (result === OK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        memory.task = REMOTE_HAULER_TRAVEL_TASK;
      }
      return REMOTE_HAULER_RETURN_TASK;
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_HAULER_TRAVEL_TASK;
    }

    return REMOTE_HAULER_RETURN_TASK;
  }

  private ensureTask(memory: RemoteHaulerMemory, creep: CreepLike): RemoteHaulerTask {
    if (
      memory.task !== REMOTE_HAULER_TRAVEL_TASK &&
      memory.task !== REMOTE_HAULER_PICKUP_TASK &&
      memory.task !== REMOTE_HAULER_RETURN_TASK
    ) {
      memory.task = REMOTE_HAULER_TRAVEL_TASK;
      return memory.task;
    }

    // Transition from travel to pickup when in target room and far from edges
    if (memory.task === REMOTE_HAULER_TRAVEL_TASK && creep.room.name === memory.targetRoom) {
      const isNearEdge = creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
      if (!isNearEdge) {
        memory.task = REMOTE_HAULER_PICKUP_TASK;
      }
    }

    // Transition from pickup to return when full
    if (memory.task === REMOTE_HAULER_PICKUP_TASK && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_HAULER_RETURN_TASK;
    }

    // Transition from return to travel when empty
    if (memory.task === REMOTE_HAULER_RETURN_TASK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_HAULER_TRAVEL_TASK;
    }

    return memory.task;
  }

  private ensureRemoteAssignments(memory: RemoteHaulerMemory, creep: CreepLike): void {
    if (!memory.homeRoom) {
      memory.homeRoom = creep.room.name ?? memory.homeRoom ?? "";
    }
    if (!memory.targetRoom) {
      memory.targetRoom = memory.homeRoom;
    }
  }
}
