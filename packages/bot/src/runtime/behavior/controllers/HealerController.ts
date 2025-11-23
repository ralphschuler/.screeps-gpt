/**
 * Healer Role Controller
 *
 * Healers are responsible for:
 * - Moving to target rooms
 * - Healing damaged friendly creeps
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";

const HEALER_HEAL_TASK = "heal" as const;

type HealerTask = typeof HEALER_HEAL_TASK;

interface HealerMemory extends CreepMemory {
  role: "healer";
  task: HealerTask;
  version: number;
  targetRoom?: string;
}

export class HealerController extends BaseRoleController<HealerMemory> {
  public constructor() {
    const config: RoleConfig<HealerMemory> = {
      minimum: 0,
      body: [HEAL, HEAL, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "healer",
        task: HEALER_HEAL_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "healer";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as HealerMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Move to target room if specified
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
      return HEALER_HEAL_TASK;
    }

    comm?.say(creep, "💚");

    // Find damaged friendly creeps
    const damagedCreeps = creep.room.find(FIND_MY_CREEPS, {
      filter: (c: Creep) => c.hits < c.hitsMax
    }) as Creep[];

    if (damagedCreeps.length > 0) {
      const target: Creep | null = creep.pos.findClosestByPath(damagedCreeps);
      const actualTarget: Creep = target ?? damagedCreeps[0];
      const result = creep.heal(actualTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
        creep.rangedHeal(actualTarget);
      }
      return HEALER_HEAL_TASK;
    }

    return HEALER_HEAL_TASK;
  }
}
