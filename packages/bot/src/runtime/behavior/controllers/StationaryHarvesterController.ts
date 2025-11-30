/**
 * Stationary Harvester Role Controller
 *
 * Stationary harvesters are responsible for:
 * - Staying at an assigned source
 * - Continuously harvesting energy
 * - Dropping energy or filling adjacent containers
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 *
 * State machine transitions:
 * - harvesting -> depositing: When creep store is full
 * - depositing -> harvesting: When creep store is empty or container is full
 *
 * Note: Unlike mobile harvesters, stationary harvesters stay in place and harvest/deposit
 * from the same position (adjacent to both source and container). This makes them more
 * efficient for container-based energy logistics.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
import { asCreep, findAllSources } from "@runtime/types/typeGuards";
import { serviceRegistry } from "./ServiceLocator";
import { StateMachine, serialize, restore } from "@ralphschuler/screeps-xstate";
import {
  stationaryHarvesterStates,
  STATIONARY_HARVESTER_INITIAL_STATE,
  type StationaryHarvesterContext,
  type StationaryHarvesterEvent
} from "../stateMachines/stationaryHarvester";

interface StationaryHarvesterMemory extends CreepMemory {
  role: "stationaryHarvester";
  task: string;
  version: number;
  sourceId?: Id<Source>;
  containerId?: Id<StructureContainer>;
  stateMachine?: unknown;
}

/**
 * Controller for stationary harvester creeps that mine from a fixed position using state machines.
 */
export class StationaryHarvesterController extends BaseRoleController<StationaryHarvesterMemory> {
  private machines: Map<string, StateMachine<StationaryHarvesterContext, StationaryHarvesterEvent>> = new Map();

  public constructor() {
    const config: RoleConfig<StationaryHarvesterMemory> = {
      minimum: 0,
      maximum: 4,
      scalingFactor: 1,
      body: [WORK, WORK, WORK, WORK, WORK, MOVE],
      version: 1,
      createMemory: () => ({
        role: "stationaryHarvester",
        task: "harvesting",
        version: 1
      })
    };
    super(config);
  }

  public getRoleName(): string {
    return "stationaryHarvester";
  }

  private lastCleanupTick = 0;

  public execute(creep: CreepLike): string {
    const memory = creep.memory as StationaryHarvesterMemory;
    const comm = serviceRegistry.getCommunicationManager();

    // Clean up machines for dead creeps every 10 ticks
    if (typeof Game !== "undefined" && Game.time - this.lastCleanupTick >= 10) {
      this.cleanupDeadCreepMachines();
      this.lastCleanupTick = Game.time;
    }

    // Get or create state machine for this creep
    // asCreep validates the CreepLike has full Creep interface required by state machine
    const validatedCreep = asCreep(creep, "StationaryHarvesterController");
    let machine = this.machines.get(creep.name);
    if (!machine) {
      if (memory.stateMachine) {
        machine = restore<StationaryHarvesterContext, StationaryHarvesterEvent>(
          memory.stateMachine,
          stationaryHarvesterStates
        );
      } else {
        machine = new StateMachine<StationaryHarvesterContext, StationaryHarvesterEvent>(
          STATIONARY_HARVESTER_INITIAL_STATE,
          stationaryHarvesterStates,
          { creep: validatedCreep, sourceId: memory.sourceId, containerId: memory.containerId }
        );
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    machine.getContext().creep = validatedCreep;
    const ctx = machine.getContext();
    const currentState = machine.getState();

    // Find or remember assigned source
    let source: Source | null = null;
    if (ctx.sourceId) {
      source = Game.getObjectById(ctx.sourceId);
    }

    if (!source) {
      const sources = findAllSources(creep.room);
      source = creep.pos.findClosestByPath(sources) ?? sources[0] ?? null;
      if (source) {
        machine.send({ type: "ASSIGN_SOURCE", sourceId: source.id });
        memory.sourceId = source.id;
      }
    }

    if (!source) {
      comm?.say(creep, "❓");
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // Find or remember adjacent container (used for depositing)
    let container: StructureContainer | null = null;
    if (ctx.containerId) {
      container = Game.getObjectById(ctx.containerId);
    }

    if (!container) {
      // Look for containers adjacent to the source position (not just adjacent to creep)
      // This helps find the container before we're in position
      const sourcePos = source.pos;
      const nearbyContainers = sourcePos.findInRange(FIND_STRUCTURES, 1, {
        filter: s => s.structureType === STRUCTURE_CONTAINER
      });

      if (nearbyContainers.length > 0) {
        container = nearbyContainers[0] as StructureContainer;
        machine.send({ type: "ASSIGN_CONTAINER", containerId: container.id });
        memory.containerId = container.id;
      }
    }

    // Execute behavior based on current state
    if (currentState === "harvesting") {
      comm?.say(creep, "⛏️");

      // Move to source if not in range
      const harvestResult = creep.harvest(source);
      if (harvestResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { range: 1, reusePath: 50 });
      }

      // Check if full and should transition to depositing
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        machine.send({ type: "ENERGY_FULL" });
      }

      // While harvesting, if we have any energy and container is adjacent, deposit opportunistically
      // This enables continuous harvest -> deposit cycle without waiting to be full
      if (container && creep.pos.isNearTo(container)) {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            creep.transfer(container, RESOURCE_ENERGY);
          }
        }
      }
    } else if (currentState === "depositing") {
      comm?.say(creep, "📦");

      // If we have a container, try to transfer energy
      if (container) {
        if (creep.pos.isNearTo(container)) {
          if (container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            creep.transfer(container, RESOURCE_ENERGY);
          } else {
            // Container is full - drop energy or transition back to harvesting
            machine.send({ type: "CONTAINER_FULL" });
          }
        } else {
          // Move to container (shouldn't happen for properly placed stationary harvesters)
          creep.moveTo(container, { range: 1, reusePath: 50 });
        }
      } else {
        // No container - just drop energy near source
        creep.drop(RESOURCE_ENERGY);
      }

      // Check if empty and should transition back to harvesting
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        machine.send({ type: "ENERGY_EMPTY" });
      }

      // While depositing, continue harvesting if adjacent to source and not full
      // This enables efficient parallel harvesting/depositing
      if (source && creep.pos.isNearTo(source)) {
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          creep.harvest(source);
        }
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
