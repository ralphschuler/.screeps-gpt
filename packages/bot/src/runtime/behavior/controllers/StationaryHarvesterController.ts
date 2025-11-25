/**
 * Stationary Harvester Role Controller
 *
 * Stationary harvesters are responsible for:
 * - Staying at an assigned source
 * - Continuously harvesting energy
 * - Dropping energy or filling adjacent containers
 *
 * Uses state machine from screeps-xstate for declarative behavior management.
 */

import { BaseRoleController, type RoleConfig } from "./RoleController";
import type { CreepLike } from "@runtime/types/GameContext";
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
          { creep: creep as Creep, sourceId: memory.sourceId, containerId: memory.containerId }
        );
      }
      this.machines.set(creep.name, machine);
    }

    // Update creep reference in context every tick
    const ctx = machine.getContext();
    ctx.creep = creep as Creep;

    comm?.say(creep, "⛏️");

    // Find or remember assigned source
    let source: Source | null = null;
    if (ctx.sourceId) {
      source = Game.getObjectById(ctx.sourceId);
    }

    if (!source) {
      const sources = creep.room.find(FIND_SOURCES) as Source[];
      source = creep.pos.findClosestByPath(sources) ?? sources[0] ?? null;
      if (source) {
        machine.send({ type: "ASSIGN_SOURCE", sourceId: source.id });
        memory.sourceId = source.id;
      }
    }

    if (!source) {
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // Harvest from source
    const harvestResult = creep.harvest(source);
    if (harvestResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, { range: 1, reusePath: 50 });
      memory.stateMachine = serialize(machine);
      memory.task = machine.getState();
      return memory.task;
    }

    // If adjacent to source and have energy, try to fill adjacent container
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      let container: StructureContainer | null = null;

      // Find or remember adjacent container
      if (ctx.containerId) {
        container = Game.getObjectById(ctx.containerId);
      }

      if (!container) {
        const nearbyContainers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
          filter: s => s.structureType === STRUCTURE_CONTAINER
        });

        if (nearbyContainers.length > 0) {
          container = nearbyContainers[0] as StructureContainer;
          machine.send({ type: "ASSIGN_CONTAINER", containerId: container.id });
          memory.containerId = container.id;
        }
      }

      if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transfer(container, RESOURCE_ENERGY);
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
