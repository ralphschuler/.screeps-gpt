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
import { moveToTargetRoom } from "./helpers";

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
    if (memory.targetRoom && moveToTargetRoom(creep, memory.targetRoom, 50)) {
      comm?.say(creep, "🔍");
    } else {
      comm?.say(creep, "👀");
    }

    return SCOUT_TASK;
  }
}
