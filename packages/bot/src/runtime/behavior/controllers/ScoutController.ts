/**
 * Scout Role Controller
 *
 * Scouts are responsible for:
 * - Moving to target rooms for reconnaissance
 * - Gathering intel about rooms
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { serviceRegistry } from "./ServiceLocator";
import { moveToTargetRoom } from "./helpers";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import { scoutStates, SCOUT_INITIAL_STATE, type ScoutContext, type ScoutEvent } from "../stateMachines/scout";

interface ScoutMemory extends CreepMemory {
  role: "scout";
  task: string;
  version: number;
  targetRoom?: string;
  stateMachine?: unknown;
}

/**
 *
 */
export class ScoutController extends BaseRoleController<ScoutMemory> {
  private machines: Map<string, StateMachine<ScoutContext, ScoutEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<ScoutMemory> = {
      minimum: 0,
      body: [MOVE],
      version: 1,
      createMemory: () => ({
        role: "scout",
        task: "idle",
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

    // Clean up machines for dead creeps to prevent memory leaks
    this.cleanupDeadCreepMachines();

    // Get or create state machine for this creep
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<ScoutContext, ScoutEvent>(memory.stateMachine, scoutStates);
      } else {
        machine = new StateMachine<ScoutContext, ScoutEvent>(SCOUT_INITIAL_STATE, scoutStates, {
          creep: creep as Creep,
          targetRoom: memory.targetRoom
        });
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick to ensure guards evaluate current state
    machine.getContext().creep = creep as Creep;

    const ctx = machine.getContext();
    const currentState = machine.getState();

    // Execute behavior based on current state
    if (currentState === "idle") {
      comm?.say(creep, "👀");
      // Check if target room is set in memory
      if (memory.targetRoom) {
        machine.send({ type: "START_SCOUT", targetRoom: memory.targetRoom });
      }
    } else if (currentState === "scouting") {
      comm?.say(creep, "🔍");

      if (ctx.targetRoom) {
        const arrived = moveToTargetRoom(creep, ctx.targetRoom, 50);
        if (arrived) {
          machine.send({ type: "ARRIVED" });
        }
      } else {
        machine.send({ type: "NO_TARGET" });
      }
    }

    // Save state to memory
    memory.stateMachine = serialize(machine);
    memory.task = currentState;
    memory.targetRoom = ctx.targetRoom;

    return currentState;
  }

  /**
   * Clean up state machines for dead creeps to prevent memory leaks.
   * This is called on every execute to ensure the machines Map doesn't grow indefinitely.
   */
  private cleanupDeadCreepMachines(): void {
    for (const creepName of this.machines.keys()) {
      if (!Game.creeps[creepName]) {
        this.machines.delete(creepName);
      }
    }
  }
}
