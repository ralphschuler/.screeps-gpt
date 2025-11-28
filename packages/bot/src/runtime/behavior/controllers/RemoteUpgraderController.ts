/**
 * Remote Upgrader Role Controller
 *
 * Remote upgraders are responsible for:
 * - Traveling to remote/integration rooms
 * - Mining energy from sources in the remote room
 * - Upgrading the remote room's controller (if owned by us)
 * - NOT returning home to deliver energy (stays in remote room)
 *
 * This role replaces the old remoteMiner role for newly claimed rooms.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { tryPickupDroppedEnergy, ROOM_CENTER_X, ROOM_CENTER_Y } from "./helpers";

const REMOTE_UPGRADER_TRAVEL_TASK = "travel" as const;
const REMOTE_UPGRADER_GATHER_TASK = "gather" as const;
const REMOTE_UPGRADER_UPGRADE_TASK = "upgrade" as const;

type RemoteUpgraderTask =
  | typeof REMOTE_UPGRADER_TRAVEL_TASK
  | typeof REMOTE_UPGRADER_GATHER_TASK
  | typeof REMOTE_UPGRADER_UPGRADE_TASK;

interface RemoteUpgraderMemory extends CreepMemory {
  role: "remoteUpgrader";
  task: RemoteUpgraderTask;
  version: number;
  homeRoom: string;
  targetRoom: string;
  sourceId?: Id<Source>;
}

/**
 * Controller for remote upgrader creeps that upgrade controllers in remote rooms.
 */
export class RemoteUpgraderController extends BaseRoleController<RemoteUpgraderMemory> {
  public constructor() {
    const config: RoleConfig<RemoteUpgraderMemory> = {
      minimum: 0,
      body: [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "remoteUpgrader",
        task: REMOTE_UPGRADER_TRAVEL_TASK,
        version: 1,
        homeRoom: "",
        targetRoom: ""
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "remoteUpgrader";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as RemoteUpgraderMemory;
    const task = this.ensureTask(memory);
    this.ensureRemoteAssignments(memory, creep);
    const comm = serviceRegistry.getCommunicationManager();

    // Travel to target room
    if (task === REMOTE_UPGRADER_TRAVEL_TASK) {
      comm?.say(creep, "travel");

      if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
        creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.targetRoom), { reusePath: 50 });
        return REMOTE_UPGRADER_TRAVEL_TASK;
      }

      // Check if creep is in target room and far enough from edges
      if (memory.targetRoom && creep.room.name === memory.targetRoom) {
        const isNearEdge = creep.pos.x <= 2 || creep.pos.x >= 47 || creep.pos.y <= 2 || creep.pos.y >= 47;
        if (isNearEdge) {
          // Move toward center when at edge to avoid getting stuck
          creep.moveTo(new RoomPosition(ROOM_CENTER_X, ROOM_CENTER_Y, memory.targetRoom), {
            reusePath: 0,
            ignoreCreeps: true
          });
          return REMOTE_UPGRADER_TRAVEL_TASK;
        }
      }

      // Arrived in target room - start gathering or upgrading based on energy
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        memory.task = REMOTE_UPGRADER_UPGRADE_TASK;
      } else {
        memory.task = REMOTE_UPGRADER_GATHER_TASK;
      }
    }

    // Gather energy in the remote room
    if (memory.task === REMOTE_UPGRADER_GATHER_TASK) {
      comm?.say(creep, "gather");

      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        memory.task = REMOTE_UPGRADER_UPGRADE_TASK;
        return REMOTE_UPGRADER_UPGRADE_TASK;
      }

      // Priority 1: Pick up dropped energy
      if (tryPickupDroppedEnergy(creep)) {
        return REMOTE_UPGRADER_GATHER_TASK;
      }

      // Priority 2: Withdraw from containers
      const containers = creep.room.find(FIND_STRUCTURES, {
        filter: (structure: AnyStructure) =>
          structure.structureType === STRUCTURE_CONTAINER && structure.store.getUsedCapacity(RESOURCE_ENERGY) > 50
      }) as StructureContainer[];

      if (containers.length > 0) {
        const container = creep.pos.findClosestByPath(containers) ?? containers[0];
        const result = creep.withdraw(container, RESOURCE_ENERGY);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, { range: 1, reusePath: 30 });
        }
        return REMOTE_UPGRADER_GATHER_TASK;
      }

      // Priority 3: Harvest from sources
      const source = this.resolveRemoteSource(creep, memory);
      if (source) {
        const result = creep.harvest(source);
        if (result === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, { range: 1, reusePath: 40 });
        }
      }

      return REMOTE_UPGRADER_GATHER_TASK;
    }

    // Upgrade the controller in the remote room
    comm?.say(creep, "upgrade");

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
      memory.task = REMOTE_UPGRADER_GATHER_TASK;
      return REMOTE_UPGRADER_GATHER_TASK;
    }

    const controller = creep.room.controller;
    if (controller?.my) {
      const result = creep.upgradeController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { range: 3, reusePath: 40 });
      }
    }

    return REMOTE_UPGRADER_UPGRADE_TASK;
  }

  private ensureTask(memory: RemoteUpgraderMemory): RemoteUpgraderTask {
    if (
      memory.task !== REMOTE_UPGRADER_TRAVEL_TASK &&
      memory.task !== REMOTE_UPGRADER_GATHER_TASK &&
      memory.task !== REMOTE_UPGRADER_UPGRADE_TASK
    ) {
      memory.task = REMOTE_UPGRADER_TRAVEL_TASK;
    }
    return memory.task;
  }

  private ensureRemoteAssignments(memory: RemoteUpgraderMemory, creep: CreepLike): void {
    if (!memory.homeRoom) {
      memory.homeRoom = creep.room.name ?? "";
    }
    if (!memory.targetRoom) {
      memory.targetRoom = memory.homeRoom;
    }
  }

  private resolveRemoteSource(creep: CreepLike, memory: RemoteUpgraderMemory): Source | null {
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
