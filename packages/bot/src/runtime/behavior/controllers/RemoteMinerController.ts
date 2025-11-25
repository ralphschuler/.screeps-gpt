/**
 * Remote Miner Role Controller
 *
 * Remote miners are responsible for:
 * - Traveling to remote rooms
 * - Mining energy from sources
 * - Upgrading the remote room's controller (if owned by us)
 * - Returning home to deliver energy (if room is not ours)
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, ROOM_CENTER_X, ROOM_CENTER_Y } from "./helpers";

const REMOTE_TRAVEL_TASK = "travel" as const;
const REMOTE_MINE_TASK = "mine" as const;
const REMOTE_RETURN_TASK = "return" as const;

type RemoteMinerTask = typeof REMOTE_TRAVEL_TASK | typeof REMOTE_MINE_TASK | typeof REMOTE_RETURN_TASK;

interface RemoteMinerMemory extends CreepMemory {
  role: "remoteMiner";
  task: RemoteMinerTask;
  version: number;
  homeRoom: string;
  targetRoom: string;
  sourceId?: Id<Source>;
}

export class RemoteMinerController extends BaseRoleController<RemoteMinerMemory> {
  public constructor() {
    const config: RoleConfig<RemoteMinerMemory> = {
      minimum: 0,
      body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "remoteMiner",
        task: REMOTE_TRAVEL_TASK,
        version: 1,
        homeRoom: "",
        targetRoom: ""
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "remoteMiner";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as RemoteMinerMemory;
    const task = this.ensureTask(memory);
    this.ensureRemoteAssignments(memory, creep);
    const comm = serviceRegistry.getCommunicationManager();

    if (task === REMOTE_TRAVEL_TASK) {
      comm?.say(creep, "travel");

      if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
        creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.targetRoom), { reusePath: 50 });
        return REMOTE_TRAVEL_TASK;
      }

      // Check if creep is in target room and far enough from edges
      if (memory.targetRoom && creep.room.name === memory.targetRoom) {
        const isNearEdge = creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
        if (isNearEdge) {
          creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.targetRoom), { reusePath: 50 });
          return REMOTE_TRAVEL_TASK;
        }
      }

      memory.task = REMOTE_MINE_TASK;
    }

    if (memory.task === REMOTE_MINE_TASK) {
      comm?.say(creep, "harvest");

      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        // When full in the remote/integration room, check if we should upgrade
        // the room's controller (if it's ours) before returning home
        const controller = creep.room.controller;
        if (controller?.my) {
          // This is an integration room we own - upgrade the controller
          const result = creep.upgradeController(controller);
          if (result === ERR_NOT_IN_RANGE) {
            creep.moveTo(controller, { range: 3, reusePath: 40 });
            comm?.say(creep, "upgrade");
            return REMOTE_MINE_TASK;
          } else if (result === OK) {
            comm?.say(creep, "upgrade");
            // Continue upgrading until empty, then go back to mining
            if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
              // Empty - continue mining
              return REMOTE_MINE_TASK;
            }
            return REMOTE_MINE_TASK;
          }
        }
        // If controller is not ours, return home with the energy
        memory.task = REMOTE_RETURN_TASK;
        comm?.say(creep, "full");
        return REMOTE_RETURN_TASK;
      }

      // Try to pick up dropped energy first
      if (tryPickupDroppedEnergy(creep)) {
        return REMOTE_MINE_TASK;
      }

      const source = this.resolveRemoteSource(creep, memory);
      if (source) {
        const result = creep.harvest(source);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 40 });
        }
      }

      return REMOTE_MINE_TASK;
    }

    comm?.say(creep, "deliver");

    if (memory.homeRoom && creep.room.name !== memory.homeRoom) {
      creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.homeRoom), { reusePath: 50 });
      return REMOTE_RETURN_TASK;
    }

    // Check if creep is in home room but near edge
    if (memory.homeRoom && creep.room.name === memory.homeRoom) {
      const isNearEdge = creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
      if (isNearEdge) {
        creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.homeRoom), { reusePath: 50 });
        return REMOTE_RETURN_TASK;
      }
    }

    const depositTargets = creep.room.find(FIND_STRUCTURES, {
      filter: (structure: AnyStructure) =>
        (structure.structureType === STRUCTURE_STORAGE ||
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION ||
          structure.structureType === STRUCTURE_CONTAINER) &&
        (structure as AnyStoreStructure).store.getFreeCapacity(RESOURCE_ENERGY) > 0
    }) as AnyStoreStructure[];

    const depositTarget =
      depositTargets.length > 0 ? (creep.pos.findClosestByPath(depositTargets) ?? depositTargets[0]) : null;
    if (depositTarget) {
      const result = creep.transfer(depositTarget, RESOURCE_ENERGY);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(depositTarget, { range: 1, reusePath: 40 });
      } else if (result === OK && creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        memory.task = REMOTE_TRAVEL_TASK;
      }
      return REMOTE_RETURN_TASK;
    }

    const controller = creep.room.controller;
    if (controller) {
      const result = creep.upgradeController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 40 });
      }
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_TRAVEL_TASK;
    }

    return REMOTE_RETURN_TASK;
  }

  private ensureTask(memory: RemoteMinerMemory): RemoteMinerTask {
    if (memory.task !== REMOTE_TRAVEL_TASK && memory.task !== REMOTE_MINE_TASK && memory.task !== REMOTE_RETURN_TASK) {
      memory.task = REMOTE_TRAVEL_TASK;
    }
    return memory.task;
  }

  private ensureRemoteAssignments(memory: RemoteMinerMemory, creep: CreepLike): void {
    if (!memory.homeRoom) {
      memory.homeRoom = creep.room.name ?? memory.homeRoom ?? "";
    }
    if (!memory.targetRoom) {
      memory.targetRoom = memory.homeRoom;
    }
  }

  private resolveRemoteSource(creep: CreepLike, memory: RemoteMinerMemory): Source | null {
    const sources = creep.room.find(FIND_SOURCES_ACTIVE) as Source[];
    if (sources.length === 0) {
      return null;
    }

    if (memory.sourceId) {
      const match = sources.find(source => source.id === memory.sourceId);
      if (match) {
        return match;
      }
    }

    const chosen = creep.pos.findClosestByPath(sources) ?? sources[0];
    if (chosen) {
      memory.sourceId = chosen.id;
    }
    return chosen;
  }
}
