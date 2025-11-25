/**
 * Healer Role Controller
 *
 * Healers are responsible for:
 * - Moving to target rooms
 * - Healing damaged friendly creeps
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  healerStates,
  HEALER_INITIAL_STATE,
  type HealerContext,
  type HealerEvent
} from "../stateMachines/healer";

interface HealerMemory extends CreepMemory {
  role: "healer";
  task: string;
  version: number;
  targetRoom?: string;
  stateMachine?: unknown;
}

/**
 * Controller for healer creeps that heal allied creeps using state machines.
 */
export class HealerController extends BaseRoleController<HealerMemory> {
  private machines: Map<string, StateMachine<HealerContext, HealerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<HealerMemory> = {
      minimum: 0,
      body: [HEAL, HEAL, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "healer",
        task: "travel",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "healer";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as HealerMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Clean up machines for dead creeps every 10 ticks
    if (typeof Game !== "undefined" && Game.time - this.lastCleanupTick >= 10) {
      this.cleanupDeadCreepMachines();
      this.lastCleanupTick = Game.time;
    }

    // Get or create state machine for this creep
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<HealerContext, HealerEvent>(memory.stateMachine, healerStates);
      } else {
        machine = new StateMachine<HealerContext, HealerEvent>(HEALER_INITIAL_STATE, healerStates, {
          creep: creep as Creep,
          targetRoom: memory.targetRoom
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    machine.getContext().creep = creep as Creep;

    const currentState = machine.getState();

    // Move to target room if specified
    if (memory.targetRoom && moveToTargetRoom(creep, memory.targetRoom, 50)) {
      comm?.say(creep, "➡️");
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // Transition to heal state if we're at the target room
    if (currentState === "travel") {
      machine.send({ type: "ARRIVED_AT_TARGET" });
    }

    comm?.say(creep, "💚");

    // Find damaged friendly creeps
    const damagedCreeps = creep.room.find(FIND_MY_CREEPS, {
      filter: (c: Creep) => c.hits < c.hitsMax
    }) as Creep[];

    if (damagedCreeps.length > 0) {
      const target: Creep | null = creep.pos.findClosestByPath(damagedCreeps);
      const actualTarget: Creep = target ?? damagedCreeps[0];
      machine.send({ type: "HEAL", targetId: actualTarget.id });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (creep.heal(actualTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        creep.rangedHeal(actualTarget);
      } else if (actualTarget.hits >= actualTarget.hitsMax) {
        machine.send({ type: "TARGET_HEALED" });
      }
    }

    // Save state to memory
    memory.stateMachine = serialize(machine);
    memory.task = machine.getState();

    return memory.task;
  }

  /**
   * Clean up state machines for dead creeps to prevent memory leaks.
   */
  private cleanupDeadCreepMachines(): void {
    // Skip cleanup if Game is not available (e.g., in tests)
    if (typeof Game === "undefined" || !Game.creeps) {
      return;
    }

    for (const creepName of this.machines.keys()) {
      if (!Game.creeps[creepName]) {
        this.machines.delete(creepName);
      }
    }
  }
}
