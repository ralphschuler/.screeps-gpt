/**
 * Dismantler Role Controller
 *
 * Dismantlers are responsible for:
 * - Moving to target rooms
 * - Dismantling hostile structures for resources
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  dismantlerStates,
  DISMANTLER_INITIAL_STATE,
  type DismantlerContext,
  type DismantlerEvent
} from "../stateMachines/dismantler";

interface DismantlerMemory extends CreepMemory {
  role: "dismantler";
  task: string;
  version: number;
  targetRoom?: string;
  stateMachine?: unknown;
}

/**
 * Controller for dismantler creeps that deconstruct enemy structures using state machines.
 */
export class DismantlerController extends BaseRoleController<DismantlerMemory> {
  private machines: Map<string, StateMachine<DismantlerContext, DismantlerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<DismantlerMemory> = {
      minimum: 0,
      body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "dismantler",
        task: "travel",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "dismantler";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as DismantlerMemory;
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
        machine = restore<DismantlerContext, DismantlerEvent>(memory.stateMachine, dismantlerStates);
      } else {
        machine = new StateMachine<DismantlerContext, DismantlerEvent>(DISMANTLER_INITIAL_STATE, dismantlerStates, {
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

    // Transition to dismantle state if we're at the target room
    if (currentState === "travel") {
      machine.send({ type: "ARRIVED_AT_TARGET" });
    }

    comm?.say(creep, "🔨");

    // Find hostile structures to dismantle
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (s: AnyStructure) => s.structureType !== STRUCTURE_CONTROLLER
    }) as AnyOwnedStructure[];

    if (hostileStructures.length > 0) {
      const target: AnyOwnedStructure | null = creep.pos.findClosestByPath(hostileStructures);
      const actualTarget: AnyOwnedStructure = target ?? hostileStructures[0];
      machine.send({ type: "DISMANTLE", targetId: actualTarget.id });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const dismantleResult = creep.dismantle(actualTarget);
      if (dismantleResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
      } else if (dismantleResult === ERR_INVALID_TARGET) {
        machine.send({ type: "TARGET_DESTROYED" });
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
