/**
 * Dismantler Role Controller
 *
 * Dismantlers are responsible for:
 * - Moving to target rooms
 * - Dismantling hostile structures for resources
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";

const DISMANTLER_DISMANTLE_TASK = "dismantle" as const;

type DismantlerTask = typeof DISMANTLER_DISMANTLE_TASK;

interface DismantlerMemory extends CreepMemory {
  role: "dismantler";
  task: DismantlerTask;
  version: number;
  targetRoom?: string;
}

export class DismantlerController extends BaseRoleController<DismantlerMemory> {
  public constructor() {
    const config: RoleConfig<DismantlerMemory> = {
      minimum: 0,
      body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "dismantler",
        task: DISMANTLER_DISMANTLE_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "dismantler";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as DismantlerMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Move to target room if specified
    if (memory.targetRoom && moveToTargetRoom(creep, memory.targetRoom, 50)) {
      comm?.say(creep, "➡️");
      return DISMANTLER_DISMANTLE_TASK;
    }

    comm?.say(creep, "🔨");

    // Find hostile structures to dismantle
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (s: AnyStructure) => s.structureType !== STRUCTURE_CONTROLLER
    }) as AnyOwnedStructure[];

    if (hostileStructures.length > 0) {
      const target: AnyOwnedStructure | null = creep.pos.findClosestByPath(hostileStructures);
      const actualTarget: AnyOwnedStructure = target ?? hostileStructures[0];
      const result = creep.dismantle(actualTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
      }
      return DISMANTLER_DISMANTLE_TASK;
    }

    return DISMANTLER_DISMANTLE_TASK;
  }
}
