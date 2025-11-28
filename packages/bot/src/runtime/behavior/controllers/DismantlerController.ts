/**
 * Dismantler Role Controller
 *
 * Dismantlers are responsible for:
 * - Moving to target rooms
 * - Dismantling hostile structures for resources (combat mode)
 * - Dismantling non-owned structures in newly claimed rooms (room clearing mode)
 *
 * Room clearing mode is used when taking over a room from another player.
 * Structures left by the previous owner need to be dismantled to clear
 * the room for new construction.
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

/**
 * Dismantler mode determines target selection behavior:
 * - "combat": Target hostile structures (enemy-owned)
 * - "clearing": Target non-owned structures in our rooms (room integration)
 */
export type DismantlerMode = "combat" | "clearing";

interface DismantlerMemory extends CreepMemory {
  role: "dismantler";
  task: string;
  version: number;
  targetRoom?: string;
  /** Dismantler mode: "combat" for hostile structures, "clearing" for room integration */
  mode?: DismantlerMode;
  /** Home room for returning after clearing is complete */
  homeRoom?: string;
  stateMachine?: unknown;
}

/**
 * Controller for dismantler creeps that deconstruct structures using state machines.
 * Supports both combat mode (hostile structures) and clearing mode (room integration).
 */
export class DismantlerController extends BaseRoleController<DismantlerMemory> {
  private machines: Map<string, StateMachine<DismantlerContext, DismantlerEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<DismantlerMemory> = {
      minimum: 0,
      maximum: 4,
      scalingFactor: 1,
      body: [WORK, WORK, CARRY, MOVE, MOVE, MOVE],
      version: 2, // Version bump for new mode support
      createMemory: () => ({
        role: "dismantler",
        task: "travel",
        version: 2,
        mode: "clearing" // Default to clearing mode for room integration
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

    // Ensure mode is set (migration from older versions)
    memory.mode ??= "clearing";

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

    // Find structures to dismantle based on mode
    const targetStructures = this.findTargetStructures(creep, memory.mode ?? "clearing");

    if (targetStructures.length > 0) {
      comm?.say(creep, memory.mode === "clearing" ? "🧹" : "🔨");
      const target = creep.pos.findClosestByPath(targetStructures) ?? targetStructures[0];
      machine.send({ type: "DISMANTLE", targetId: target.id });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      const dismantleResult = creep.dismantle(target);
      if (dismantleResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, { reusePath: 10 });
      } else if (dismantleResult === ERR_INVALID_TARGET) {
        machine.send({ type: "TARGET_DESTROYED" });
      }
    } else {
      // No structures to dismantle - idle
      comm?.say(creep, "✅");
    }

    // Save state to memory
    memory.stateMachine = serialize(machine);
    memory.task = machine.getState();

    return memory.task;
  }

  /**
   * Find target structures based on dismantler mode.
   *
   * @param creep - The dismantler creep
   * @param mode - The dismantler mode ("combat" or "clearing")
   * @returns Array of structures to dismantle
   */
  private findTargetStructures(creep: CreepLike, mode: DismantlerMode): AnyStructure[] {
    if (mode === "combat") {
      // Combat mode: target hostile structures (enemy-owned)
      return creep.room.find(FIND_HOSTILE_STRUCTURES, {
        filter: (s: AnyStructure) => s.structureType !== STRUCTURE_CONTROLLER
      }) as AnyStructure[];
    }

    // Clearing mode: target non-owned structures in our rooms
    // This is used when taking over a room from another player
    // We only clear structures if we own the room (controller.my)
    const controller = creep.room.controller;
    if (!controller?.my) {
      // Room is not ours - nothing to clear
      return [];
    }

    // Find all structures that are not ours
    // This includes:
    // - Neutral structures (abandoned by previous owner)
    // - Structures owned by others (should not happen in our room but safety check)
    const structuresToClear = creep.room.find(FIND_STRUCTURES, {
      filter: (s: AnyStructure) => {
        // Never dismantle controllers
        if (s.structureType === STRUCTURE_CONTROLLER) {
          return false;
        }

        // Check if structure is owned and not ours
        if ("my" in s) {
          // Owned structure - only dismantle if not ours
          return (s as OwnedStructure).my === false;
        }

        // For non-ownable structures (roads, containers, walls), check if we want to keep them
        // Roads and containers from previous owners can be kept as they're useful
        // Only clear walls and ramparts that might block our layout
        if (s.structureType === STRUCTURE_ROAD || s.structureType === STRUCTURE_CONTAINER) {
          return false; // Keep roads and containers
        }

        // Clear player-built walls left by previous owner
        // STRUCTURE_WALL refers to walls constructed by players using Wall.build()
        // These are distinct from natural terrain walls (blocked tiles) which are
        // part of the map terrain and cannot be targeted or dismantled
        if (s.structureType === STRUCTURE_WALL) {
          return true; // Clear constructed walls
        }

        return false;
      }
    }) as AnyStructure[];

    return structuresToClear;
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
