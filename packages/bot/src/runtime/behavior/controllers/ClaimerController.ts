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
    if (memory.targetRoom && creep.room.name !== memory.targetRoom) {
      comm?.say(creep, "➡️");
      const exitDir: ExitConstant | ERR_NO_PATH | ERR_INVALID_ARGS = creep.room.findExitTo(memory.targetRoom);
      if (typeof exitDir === "number" && exitDir >= 1 && exitDir <= 8) {
        const exitPositions = creep.room.find(exitDir as ExitConstant) as RoomPosition[];
        if (exitPositions.length > 0) {
          const exitPos: RoomPosition | null = creep.pos.findClosestByPath(exitPositions);
          const actualExitPos: RoomPosition = exitPos ?? exitPositions[0];
          creep.moveTo(actualExitPos, { reusePath: 50 });
        }
      }
      return CLAIMER_CLAIM_TASK;
    }

    const controller = creep.room.controller;
    if (!controller) {
      return CLAIMER_CLAIM_TASK;
    }

    // Reserve or claim based on memory flag
    if (memory.reserveOnly) {
      comm?.say(creep, "🔰");
      const result = creep.reserveController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { reusePath: 50 });
      }
    } else {
      comm?.say(creep, "🏴");
      const result = creep.claimController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { reusePath: 50 });
      }
    }

    return CLAIMER_CLAIM_TASK;
  }
}
