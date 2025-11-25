/**
 * Attacker Role Controller
 *
 * Attackers are responsible for:
 * - Moving to target rooms
 * - Attacking hostile creeps (priority)
 * - Attacking hostile structures
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";

const ATTACKER_ATTACK_TASK = "attack" as const;

type AttackerTask = typeof ATTACKER_ATTACK_TASK;

interface AttackerMemory extends CreepMemory {
  role: "attacker";
  task: AttackerTask;
  version: number;
  targetRoom?: string;
}

/**
 * Controller for attacker creeps that engage hostile targets.
 */
export class AttackerController extends BaseRoleController<AttackerMemory> {
  public constructor() {
    const config: RoleConfig<AttackerMemory> = {
      minimum: 0,
      body: [ATTACK, ATTACK, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "attacker",
        task: ATTACKER_ATTACK_TASK,
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "attacker";
  }

  public execute(creep: CreepLike): string {
    const memory = creep.memory as AttackerMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Move to target room if specified
    if (memory.targetRoom && moveToTargetRoom(creep, memory.targetRoom, 50)) {
      comm?.say(creep, "➡️");
      return ATTACKER_ATTACK_TASK;
    }

    comm?.say(creep, "⚔️");

    // Priority 1: Attack hostile creeps
    const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS) as Creep[];
    if (hostileCreeps.length > 0) {
      const target: Creep | null = creep.pos.findClosestByPath(hostileCreeps);
      const actualTarget: Creep = target ?? hostileCreeps[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = creep.attack(actualTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
      }
      return ATTACKER_ATTACK_TASK;
    }

    // Priority 2: Attack hostile structures
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (s: AnyStructure) => s.structureType !== STRUCTURE_CONTROLLER
    }) as AnyOwnedStructure[];

    if (hostileStructures.length > 0) {
      const target: AnyOwnedStructure | null = creep.pos.findClosestByPath(hostileStructures);
      const actualTarget: AnyOwnedStructure = target ?? hostileStructures[0];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const result = creep.attack(actualTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
      }
      return ATTACKER_ATTACK_TASK;
    }

    return ATTACKER_ATTACK_TASK;
  }
}
