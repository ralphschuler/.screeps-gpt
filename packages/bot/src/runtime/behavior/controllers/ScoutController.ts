/**
 * Scout Role Controller
 *
 * Scouts are responsible for:
 * - Moving to target rooms for reconnaissance
 * - Gathering intel about rooms
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";

const SCOUT_TASK = "scout" as const;

type ScoutTask = typeof SCOUT_TASK;

interface ScoutMemory extends CreepMemory {
  role: "scout";
  task: ScoutTask;
  version: number;
  targetRoom?: string;
}

export class ScoutController extends BaseRoleController<ScoutMemory> {
  public constructor() {
    const config: RoleConfig<ScoutMemory> = {
      minimum: 0,
      body: [MOVE],
      version: 1,
      createMemory: () => ({
        role: "scout",
        task: SCOUT_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "scout";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as ScoutMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Move to target room if specified
    if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
      comm?.say(creep, "🔍");
      const exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(memory.targetRoom);
      if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
        const exitPositions = creep.room.find(exitDir as ExitConstant) as RoomPosition[];
        if (exitPositions.length > 0) {
          const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions);
          const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
          creep.moveTo(actualExitPos, { reusePath: 50 });
        }
      }
    } else {
      comm?.say(creep, "👀");
    }

    return SCOUT_TASK;
  }
}
