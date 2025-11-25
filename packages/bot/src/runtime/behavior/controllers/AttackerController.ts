/**
 * Attacker Role Controller
 *
 * Attackers are responsible for:
 * - Moving to target rooms
 * - Attacking hostile creeps (priority)
 * - Attacking hostile structures
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  attackerStates,
  ATTACKER_INITIAL_STATE,
  type AttackerContext,
  type AttackerEvent
} from "../stateMachines/attacker";

interface AttackerMemory extends CreepMemory {
  role: "attacker";
  task: string;
  version: number;
  targetRoom?: string;
  stateMachine?: unknown;
}

/**
 * Controller for attacker creeps that engage hostile targets using state machines.
 */
export class AttackerController extends BaseRoleController<AttackerMemory> {
  private machines: Map<string, StateMachine<AttackerContext, AttackerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<AttackerMemory> = {
      minimum: 0,
      body: [ATTACK, ATTACK, MOVE, MOVE],
      version: 1,
      createMemory: () => ({
        role: "attacker",
        task: "travel",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "attacker";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as AttackerMemory;
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
        machine = restore<AttackerContext, AttackerEvent>(memory.stateMachine, attackerStates);
      } else {
        machine = new StateMachine<AttackerContext, AttackerEvent>(ATTACKER_INITIAL_STATE, attackerStates, {
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

    // Transition to attack state if we're at the target room
    if (currentState === "travel") {
      machine.send({ type: "ARRIVED_AT_TARGET" });
    }

    comm?.say(creep, "⚔️");

    // Priority 1: Attack hostile creeps
    const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS) as Creep[];
    if (hostileCreeps.length > 0) {
      const target: Creep | null = creep.pos.findClosestByPath(hostileCreeps);
      const actualTarget: Creep = target ?? hostileCreeps[0];
      machine.send({ type: "ENGAGE", targetId: actualTarget.id });
      const result = creep.attack(actualTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
      }
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // Priority 2: Attack hostile structures
    const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES, {
      filter: (s: AnyStructure) => s.structureType !== STRUCTURE_CONTROLLER
    }) as AnyOwnedStructure[];

    if (hostileStructures.length > 0) {
      const target: AnyOwnedStructure | null = creep.pos.findClosestByPath(hostileStructures);
      const actualTarget: AnyOwnedStructure = target ?? hostileStructures[0];
      machine.send({ type: "ENGAGE", targetId: actualTarget.id });
      const result = creep.attack(actualTarget);
      if (result === ERR_NOT_IN_RANGE) {
        creep.moveTo(actualTarget, { reusePath: 10 });
      }
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
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
