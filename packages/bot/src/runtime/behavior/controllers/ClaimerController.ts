/**
 * Claimer Role Controller
 *
 * Claimers are responsible for:
 * - Moving to target rooms
 * - Claiming or reserving room controllers
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  claimerStates,
  CLAIMER_INITIAL_STATE,
  type ClaimerContext,
  type ClaimerEvent
} from "../stateMachines/claimer";

interface ClaimerMemory extends CreepMemory {
  role: "claimer";
  task: string;
  version: number;
  targetRoom?: string;
  reserveOnly?: boolean;
  stateMachine?: unknown;
}

/**
 * Controller for claimer creeps that claim or reserve room controllers using state machines.
 */
export class ClaimerController extends BaseRoleController<ClaimerMemory> {
  private machines: Map<string, StateMachine<ClaimerContext, ClaimerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<ClaimerMemory> = {
      minimum: 0,
      body: [CLAIM, MOVE],
      version: 1,
      createMemory: () => ({
        role: "claimer",
        task: "travel",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "claimer";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as ClaimerMemory;
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
        machine = restore<ClaimerContext, ClaimerEvent>(memory.stateMachine, claimerStates);
      } else {
        machine = new StateMachine<ClaimerContext, ClaimerEvent>(CLAIMER_INITIAL_STATE, claimerStates, {
          creep: creep as Creep,
          targetRoom: memory.targetRoom ?? "",
          homeRoom: creep.room.name
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    machine.getContext().creep = creep as Creep;

    const currentState = machine.getState();

    // Move to target room if not there yet
    if (memory.targetRoom && moveToTargetRoom(creep, memory.targetRoom, 50)) {
      comm?.say(creep, "➡️");
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // Transition to claim state if we're at the target room
    if (currentState === "travel") {
      machine.send({ type: "ARRIVED_AT_TARGET" });
    }

    const controller = creep.room.controller;
    if (!controller) {
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // Reserve or claim based on memory flag
    if (memory.reserveOnly) {
      comm?.say(creep, "🔰");
      const result = creep.reserveController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { reusePath: 50 });
      } else if (result === OK) {
        machine.send({ type: "CLAIM_COMPLETE" });
      }
    } else {
      comm?.say(creep, "🏴");
      const result = creep.claimController(controller);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller, { reusePath: 50 });
      } else if (result === OK) {
        machine.send({ type: "CLAIM_COMPLETE" });
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
