/**
 * Claimer Role Controller
 *
 * Claimers are responsible for:
 * - Moving to target rooms
 * - Claiming or reserving room controllers
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";

const CLAIMER_CLAIM_TASK = "claim" as const;

type ClaimerTask = typeof CLAIMER_CLAIM_TASK;

interface ClaimerMemory extends CreepMemory {
  role: "claimer";
  task: ClaimerTask;
  version: number;
  targetRoom?: string;
  reserveOnly?: boolean;
}

export class ClaimerController extends BaseRoleController<ClaimerMemory> {
  public constructor() {
    const config: RoleConfig<ClaimerMemory> = {
      minimum: 0,
      body: [CLAIM, MOVE],
      version: 1,
      createMemory: () => ({
        role: "claimer",
        task: CLAIMER_CLAIM_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "claimer";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as ClaimerMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Move to target room if not there yet
    if (memory.targetRoom && moveToTargetRoom(creep, memory.targetRoom, 50)) {
      comm?.say(creep, "➡️");
      return CLAIMER_CLAIM_TASK;
    }

    const controller = creep.room.controller;
    if (!controller) {
      return CLAIMER_CLAIM_TASK;
    }

    // Reserve or claim based on memory flag
    if (memory.reserveOnly) {
      comm?.say(creep, "🔰");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = creep.reserveController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { reusePath: 50 });
      }
    } else {
      comm?.say(creep, "🏴");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = creep.claimController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { reusePath: 50 });
      }
    }

    return CLAIMER_CLAIM_TASK;
  }
}
